//@ts-check

const sql = require('mssql');

const defaultValues = {
	UID: '',
	RRN: '',
	Shovar: '',
	CardType: '',
	ShovarPrint: '',
	TeudaStatus: '1',
};

/**
 *
 * @param {{uid: string, rrn: string, authManpikNo: string, cardType: string, MerchantNote: string, TeudaStatus: string, CreditTerms: number, Payments: number, TransactionID: string, TeudaSum: number, pan: string, addendum1: string, amount: number}} payload
 * @param {boolean} hasTimedOut
 * @returns
 */
module.exports = async function (payload, hasTimedOut) {
	const uid = payload.uid || defaultValues.UID;
	const rrn = payload.rrn || defaultValues.RRN;
	const authManpikNo = payload.authManpikNo || defaultValues.Shovar;
	const cardType = payload.cardType || defaultValues.CardType;
	const MerchantNote = payload.MerchantNote || defaultValues.ShovarPrint;
	const TeudaStatus = hasTimedOut ? '12' : payload.TeudaStatus || defaultValues.TeudaStatus;
	const CreditTerms = payload.CreditTerms;
	const Payments = payload.Payments;
	const TransactionID = payload.TransactionID;
	const TeudaSum = payload.TeudaSum;
	const pan = payload.pan;
	const TeudaNum = payload.addendum1;
	const addendum1 = TeudaNum;
	const amount = payload.amount;

	const result =
		await sql.query`INSERT INTO [MSFDB].[dbo].[CreditTransaction] (TeudaNum, Addendum1, TeudaSum, Sum, CreditTerms, Payments, TransactionID, UID, RRN, Shovar, CreditNumPan, CardType, ShovarPrint, TeudaStatus) VALUES (${TeudaNum}, ${addendum1}, ${TeudaSum}, ${amount}, ${CreditTerms}, ${Payments}, ${TransactionID}, ${uid}, ${rrn}, ${authManpikNo}, ${pan}, ${cardType}, ${MerchantNote}, ${TeudaStatus})`;

	return result;
};
