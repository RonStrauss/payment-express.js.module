//@ts-check
const express = require('express');
const postNewPaymentExternalAPI = require('./postNewPaymentExternalAPI');
const handlePostNewReceipt = require('./handlePostNewReceiptLocal');
const handleInsertNewPaymentLocal = require('./handleInsertNewPaymentLocal');
const {
	checkValidityOfInitialPayload,
	checkIfDocAlreadyExistsInDB,
	insertNewOrderWithPayment,
	checkIfDocAlreadyPaidInLocalDB,
	deconstructIdentifiers,
	identifierRecord,
} = require('./utilsForSQL');
const findExistingTransactionIDExternalAPI = require('./findExistingTransactionIDExternalAPI');
const parameters = require('./parameters');

const router = require('express').Router();
const sql = require('mssql');
const paymentParameters = require('./parameters');
const readArkomXMLResponse = require('./readArkomXMLResponse');

const isDevelopment = process.env.NODE_ENV === 'development';

const TransactionIDsAndTeudaNums = require('./TransactionIDsAndTeudaNums');
const { checkIfTotalSumMatchesAcceptableDifference } = require('./utils');

router
	.get('/parameters', async (req, res) => {
		// deep copy of object
		const params = JSON.parse(JSON.stringify(paymentParameters));

		delete params.apiPayloadDetails.staticParameters;
		delete params.xmlns;
		delete params.desiredXMLOrder;
		delete params.identifier;
		delete params.password;

		return res.send(params);
	})
	.get('/transactionID-check/:TransactionID', async (req, res) => {
		try {
			const query = `SELECT * FROM [CreditTransaction] WHERE [TransactionID] = '${req.params.TransactionID}'`;
			const { recordset } = await sql.query(query);

			if (!recordset.length) return res.send({ found: false, msg: 'TransactionID not found in local DB' });

			return res.send({ found: recordset.length, lines: recordset });
		} catch (error) {
			return res.status(500).send({ err: true, msg: 'Internal server error', reason: { name: error.name, message: error.message } });
		}
	})
	.get('/transactionID-check-external/:TransactionID', async (req, res) => {
		try {
			const response = await findExistingTransactionIDExternalAPI(req.params.TransactionID);
			const { success, payload } = await readArkomXMLResponse(response, 'checkTransactionAfterFailure');
			if (!success) {
				return res.status(400).send({ err: true, msg: 'עסקה לא קיימת.', ...payload });
			}
			return res.send({ found: true, lines: payload });
		} catch (error) {
			if (error.message === parameters.axiosErrorMessages.timeout) {
				return res.status(400).send({ err: true, msg: parameters.axiosErrorMessages.timeout });
			}
			return res.status(500).send({ err: true, msg: 'Internal server error', reason: { name: error.name, message: error.message } });
		}
	})
	.patch('/change-status/:TransactionID', async (req, res) => {
		try {
			const { TransactionID } = req.params;
			const { newStatus } = req.body;

			const query = `UPDATE [CreditTransaction] SET [TeudaStatus] = '${newStatus}' WHERE [TransactionID] = '${TransactionID}'`;
			const { rowsAffected } = await sql.query(query);

			if (!rowsAffected[0]) return res.status(400).send({ err: true, msg: 'TransactionID not found in local DB' });

			return res.send({ success: true, msg: 'status changed successfully' });
		} catch (error) {
			return res.status(500).send({ err: true, msg: 'Internal server error', reason: { name: error.name, message: error.message } });
		}
	})
	.post('/new/order', async (req, res) => {
		await handlePOSTRequest(req, res, 'order');
	})
	.post('/new/receipt', async (req, res) => {
		await handlePOSTRequest(req, res, 'receipt');
	});

/**
 * @param {express.Request & {body:any}} req
 * @param {express.Response} res
 * @param {import('./utils').PaymentModes} mode
 */
async function handlePOSTRequest(req, res, mode) {
	const { identifier, totalSum } = deconstructIdentifiers(req.body, mode);
	const objectName = mode[0].toUpperCase() + mode.slice(1);
	if (TransactionIDsAndTeudaNums.has(identifier)) return res.status(400).send({ err: true, msg: `${objectName} is already being processed` });
	try {
		if (!checkValidityOfInitialPayload(mode, req)) return res.status(400).send({ err: true, msg: 'illegal body' });

		const doesReceiptAlreadyExist = await checkIfDocAlreadyExistsInDB(identifier, mode);

		if (doesReceiptAlreadyExist) return res.status(400).send({ err: true, msg: `${objectName} already exists` });

		const receiptAlreadyPaid = await checkIfDocAlreadyPaidInLocalDB(identifier);

		if (receiptAlreadyPaid.length) {
			const paymentDetails = receiptAlreadyPaid[0];
			const { TransSum } = paymentDetails;

			if (!checkIfTotalSumMatchesAcceptableDifference(+TransSum, +totalSum)) {
				return res.status(400).send({ err: true, msg: `${objectName} already paid with different amount` });
			}
			try {
				const result = await handleResolveMethod(req, res, mode, { paymentDetails, alreadyPaid: true });
				return result;
			} catch (error) {
				return res.status(500).send({ err: true, msg: 'Internal server error', reason: { name: error.name, message: error.message } });
			}
		}

		handlePaymentProcess(req, res, mode, { identifier, totalSum });
	} catch (err) {
		console.log(err, 'error in handlePOSTRequest');
		return res
			.status(500)
			.send({ err: true, msg: 'קרתה תקלה בעת שידור עסקת אשראי. אנא נסה שנית מאוחר יותר.', reason: { name: err.name, message: err.message } });
	}
}

/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {keyof typeof identifierRecord} mode
 * @param {{paymentDetails: any, alreadyPaid: boolean}} param2
 * @returns
 */
async function handleResolveMethod(req, res, mode, { paymentDetails, alreadyPaid }) {
	if (mode === 'receipt') {
		if (!alreadyPaid) {
			const body = { ...req.body, ...paymentDetails };
			req.body = body;
		}
		return await handlePostNewReceipt(req, res);
	}

	if (mode === 'order') {
		if (alreadyPaid) {
			delete paymentDetails.CVV2;
			paymentDetails.PAN = paymentDetails.PAN.slice(-4);
			delete paymentDetails.Expiry;
			delete paymentDetails.ID;
		}
		return insertNewOrderWithPayment(req, res, paymentDetails);
	}
}

/**
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {keyof typeof identifierRecord} mode
 * @param {{identifier:typeof identifierRecord[keyof typeof identifierRecord], totalSum:number}} param3
 */
function handlePaymentProcess(req, res, mode, { identifier, totalSum }) {
	const { Payments, CreditTerms, PAN, CVV2, Expiry, ID, TransSum } = req.body;
	const ExpiryFormatted = `${Expiry.YY}${Expiry.MM}`;

	TransactionIDsAndTeudaNums.addOnlyTeudaNum(identifier);

	postNewPaymentExternalAPI({
		Payments,
		CreditTerms,
		Addendum1: identifier,
		PAN,
		CVV2,
		Expiry: ExpiryFormatted,
		ID,
		TransSum,
		Addendum1Settl: identifier,
	})
		.then((response) => {
			readArkomXMLResponse(response)
				.then(async (formatted) => {
					if (!formatted.success) {
						return res.status(400).send({ err: true, msg: formatted.payload.AshStatusDesc, ...formatted });
					}

					await handleInsertNewPaymentLocal({ ...formatted.payload, CreditTerms, Payments, TeudaSum: totalSum }, false);

					return await handleResolveMethod(req, res, mode, { paymentDetails: formatted.payload, alreadyPaid: false });
				})
				.catch((err) => {
					console.log(err, 'error in readArkomXMLResponse');
					return res
						.status(500)
						.send({ err: true, msg: 'קרתה תקלה בעת שידור עסקת אשראי. אנא נסה שנית מאוחר יותר.', reason: { name: err.name, message: err.message } });
				})
				.finally(() => {
					TransactionIDsAndTeudaNums.remove(identifier);
				});
		})
		.catch(async (err) => {
			if (err.message === 'failed to get new transaction ID') {
				console.log(err, 'error in postNewPayment');
				return res
					.status(500)
					.send({ err: true, msg: 'קרתה תקלה בעת שידור עסקת אשראי. אנא נסה שנית מאוחר יותר.', reason: { name: err.name, message: err.message } });
			}

			const currentTransactionID = TransactionIDsAndTeudaNums.get(identifier);
			let response = '';
			try {
				response = await findExistingTransactionIDExternalAPI(currentTransactionID);
				const { success, payload } = await readArkomXMLResponse(response, 'checkTransactionAfterFailure');
				if (!success) {
					return res
						.status(400)
						.send({ err: true, msg: 'קרתה תקלה בעת שידור עסקת אשראי. אנא נסה שנית מאוחר יותר.', reason: { name: err.name, message: err.message } });
				}

				payload.TransactionID = currentTransactionID;
				payload.addendum1 = identifier;

				await handleInsertNewPaymentLocal({ ...payload, CreditTerms, Payments, TeudaSum: totalSum }, false);

				return await handleResolveMethod(req, res, mode, { paymentDetails: payload, alreadyPaid: false });
			} catch (error) {
				console.log(error, 'error in findExistingTransactionIDExternalAPI');
				if (error.message === parameters.axiosErrorMessages.timeout) {
					await handleInsertNewPaymentLocal(
						{
							...req.body,
							CreditTerms,
							Payments,
							TeudaSum: totalSum,
							addendum1: identifier,
							pan: PAN.slice(-4),
							amount: TransSum,
							TransactionID: currentTransactionID,
						},
						true,
					);
					return res
						.status(400)
						.send({ err: true, msg: parameters.axiosErrorMessages.timeout, payload: { TransactionID: currentTransactionID, TeudaNum: identifier } });
				}
			}

			console.log(err, 'error in postNewPayment');
			return res
				.status(500)
				.send({ err: true, msg: 'קרתה תקלה בעת שידור עסקת אשראי. אנא נסה שנית מאוחר יותר.', reason: { name: err.name, message: err.message } });
		})
		.finally(() => {
			TransactionIDsAndTeudaNums.remove(identifier);
		});
}

module.exports = router;
