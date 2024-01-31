//@ts-check
const xml2js = require('xml2js');

/**
 * @param {string} stringResponseFromArkom
 * @param {'payment'|'transactionID'|'checkTransactionAfterFailure'} mode
 * @returns
 */
module.exports = async (stringResponseFromArkom, mode = 'payment') => {
	if (!stringResponseFromArkom) return { success: false, msg: 'no response from arkom' };
	try {
		const responseXMLStringified = await xml2js.parseStringPromise(stringResponseFromArkom);

		if (mode === 'transactionID') {
			return getTransactionIDFromResponseObject(responseXMLStringified);
		}

		if (mode === 'checkTransactionAfterFailure') {
			const ansXML = getansXMLFromResponseObject(responseXMLStringified);
			if (!ansXML.length) {
				return { success: false, msg: 'transaction doesnt exist' };
			}
			const payload = await extractPayloadFromSuccessResponseObject(ansXML, 'mNote');
			return { success: true, payload };
		}

		const { IntOTxml, TransactionID, AshStatus, AshStatusDesc } = getIntOTxmlAndTransactionIDFromResponseObject(responseXMLStringified);

		if (AshStatus !== '0') {
			return { success: false, payload: { AshStatus, AshStatusDesc } };
		}

		const payload = await extractPayloadFromSuccessResponseObject(IntOTxml, 'MerchantNote');

		return {
			success: true,
			payload: {
				...payload,
				TransactionID,
			},
		};
	} catch (err) {
		console.error(err.name);
		throw err;
	}
};

/**
 *
 * @param {*} object
 * @param {'mNote'|'MerchantNote'} merchantNoteProp
 * @returns {Promise<{uid: string, pan: string, rrn: string, addendum1: string, authManpikNo: string, cardType: string, amount: number, MerchantNote: string}>}
 */
async function extractPayloadFromSuccessResponseObject(object, merchantNoteProp) {
	const MerchantNote = object[merchantNoteProp];
	const parsedXML = (await xml2js.parseStringPromise(object, { explicitArray: false }))['output'];

	const { uid, pan, rrn, addendum1, authManpikNo, cardType } = parsedXML;
	const amount = +parsedXML['amount'] / 100 || 0;

	return { uid, pan, rrn, addendum1, authManpikNo, cardType, amount, MerchantNote };
}

/**
 *
 * @param {*} object
 * @returns {{IntOTxml: string, TransactionID: string, AshStatus: string, AshStatusDesc: string, MerchantNote: string}}
 */
function getIntOTxmlAndTransactionIDFromResponseObject(object) {
	const { MerchantNote, IntOTxml, TransactionID, AshStatus, AshStatusDesc } = getSOAPBodyFromResponseObject(object)['MTS_AshEMV_CNP_TransactionResponse'][0];
	return { IntOTxml, TransactionID: TransactionID[0], AshStatus: AshStatus[0], AshStatusDesc: AshStatusDesc[0], MerchantNote: MerchantNote[0] };
}

function getTransactionIDFromResponseObject(object) {
	return getSOAPBodyFromResponseObject(object)['MTS_GetTransactionIDResponse'][0]['TransactionID'][0];
}

function getansXMLFromResponseObject(object) {
	return getSOAPBodyFromResponseObject(object)['MTS_EMV_RetakeTrans_XML_NotesResponse'][0]['ansXML'][0];
}

function getSOAPBodyFromResponseObject(object) {
	return object['soap:Envelope']['soap:Body'][0];
}
