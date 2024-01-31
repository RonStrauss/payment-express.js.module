//@ts-check
const path = require('node:path');
const identifier = process.env.ARKOM_IDENTIFIER || '0';
const password = process.env.ARKOM_IDENTIFIER || '0';
const methodName = process.env.ARKOM_METHOD_NAME || 'test';
const xmlns = process.env.ARKOM_XMLNS || 'http://www.arkom.co.il/';
let apiEndpoint = `${xmlns}wsdev/MTS_WebService.asmx`;

const hasPayments = true;
const needsToProvideCVVAndIsraeliID = false;
const canProduceReceiptWithoutFullPayment = true;

if (process.env.NODE_ENV !== 'development') {
	apiEndpoint = process.env.ARKOM_PRODUCTION_API_ENDPOINT || `${xmlns}ws/MTS_WebService.asmx`;
}

const defaultPaymentLevels = [
	{ payments: 1, minCredit: 0 },
	{ payments: 2, minCredit: 2000 },
	{ payments: 3, minCredit: 6000 },
];

const cardTypes = {
	mastercard: {
		allowed: true,
		hebrewName: 'מאסטרקארד',
		customPaymentLevels: [
			{ payments: 1, minCredit: 0 },
			{ payments: 2, minCredit: 500 },
			{ payments: 3, minCredit: 2000 },
			{ payments: 4, minCredit: 8000 },
		],
	},
	visa: {
		hebrewName: 'ויזה',
		allowed: true,
	},
	americanExpress: {
		hebrewName: 'אמריקן אקספרס',
		allowed: true,
	},
	diners: {
		hebrewName: 'דיינרס',
		allowed: false,
	},
	isracardDebit: {
		hebrewName: 'ישראכרט',
		allowed: true,
	},
	isracardDirect: {
		hebrewName: 'ישראכרט דיירקט',
		allowed: true,
	},
};

const staticParametersWithoutIDs = { PrmJ: 0, EntryMode: '50', Currency: 376, TransType: '01', PosNum: '0', CashBackSum: 0, Payment1: 0, PaymentN: 0 };

const staticParameters = {
	...staticParametersWithoutIDs,
	TerminalNUM: identifier,
	Password: identifier,
};

const dynamicParameters = {
	Payments: 1,
	CreditTerms: 1,
	Addendum1: '',
	Addendum1Settl: '',
	CVV2: '',
	ID: '',
	TransactionID: '',
};

const emptyFields = [
	'Addendum2',
	'Addendum2Settl',
	'Addendum3Settl',
	'Addendum4Settl',
	'Addendum5Settl',
	'AshStatus',
	'AshStatusDesc',
	'IntOTxml',
	'MerchantNote',
	'ClientNote',
	'ErrorDesc',
	'TruncPAN',
	'ApprovalCode',
];

const desiredXMLOrder = [
	'TerminalNUM',
	'Password',
	'TransactionID',
	'PrmJ',
	'PAN',
	'Expiry',
	'TransSum',
	'CVV2',
	'ID',
	'ApprovalCode',
	'PosNum',
	'CashBackSum',
	'EntryMode',
	'Currency',
	'CreditTerms',
	'TransType',
	'Payments',
	'Payment1',
	'PaymentN',
	'Addendum1',
	'Addendum2',
	'Addendum1Settl',
	'Addendum2Settl',
	'Addendum3Settl',
	'Addendum4Settl',
	'Addendum5Settl',
	'TruncPAN',
	'AshStatus',
	'AshStatusDesc',
	'IntOTxml',
	'MerchantNote',
	'ClientNote',
	'ErrorDesc',
];

const axiosErrorMessages = {
	timeout: 'request timed out',
	'Network Error': 'network error',
	500: 'internal server error',
	400: 'bad request',
};

module.exports = {
	axiosErrorMessages,
	methodName,
	needsToProvideCVVAndIsraeliID,
	canProduceReceiptWithoutFullPayment,
	defaultPaymentLevels,
	cardTypes,
	hasPayments,
	apiPayloadDetails: {
		staticParametersWithoutIDs,
		staticParameters,
		dynamicParameters,
		emptyFields,
	},
	apiEndpoint,
	xmlns,
	desiredXMLOrder,
	identifier,
	password,
};
