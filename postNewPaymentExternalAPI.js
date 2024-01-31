//@ts-check
const parameters = require('./parameters');
const axios = require('axios').default;
const readArkomXMLResponse = require('./readArkomXMLResponse');
const { orderXMLArray, extractXMLValueAndFormatForRequest, formatAsXMLSOAPBody, formatAsXMLField, mapArrayOfFieldsToXML, getAxiosConfig } = require('./utils');

const {  apiPayloadDetails, needsToProvideCVVAndIsraeliID } = parameters;
const { staticParameters, dynamicParameters, emptyFields } = apiPayloadDetails;

const TransactionIDsAndTeudaNums = require('./TransactionIDsAndTeudaNums');

const isDevelopment = process.env.NODE_ENV === 'development';

module.exports = async ({ Payments, CreditTerms, Addendum1, PAN, CVV2, Expiry, ID, TransSum, Addendum1Settl }) => {

	let TransactionID = '';
	try {
		const response = await getNewTransactionID();
		TransactionID = await readArkomXMLResponse(response, 'transactionID');
		if (!TransactionID) throw new Error('failed to get new transaction ID');
		TransactionIDsAndTeudaNums.add({ Addendum1, TransactionID });
	} catch (error) {
		throw new Error('failed to get new transaction ID');
	}

	const input = prepareInputObject({ Addendum1, Addendum1Settl, PAN, Expiry, TransSum, Payments, CreditTerms, CVV2, ID, TransactionID });

	const allFieldsMapped = getArrayOfMappedFieldsToValues(input);

	const allFieldsMappedAndSorted = orderXMLArray(allFieldsMapped);

	const allFieldsFormattedToXML = extractXMLValueAndFormatForRequest(allFieldsMappedAndSorted);

	const body = formatAsXMLSOAPBody(allFieldsFormattedToXML);

	const axiosConfig = getAxiosConfig(body);

	const res = await axios(axiosConfig);

	if (res.status !== 200) throw new Error('response not ok' + res.statusText);

	// if (isDevelopment){
	// 	throw new Error(parameters.axiosErrorMessages.timeout);
	// }

	return res.data;
};

async function getNewTransactionID() {

	const arrayOfFieldsToXML = [
		{ xml: formatAsXMLField('TerminalNum', staticParameters.TerminalNUM) },
		{ xml: formatAsXMLField('Password', staticParameters.Password) },
		{ xml: formatAsXMLField('TransactionID') },
	];

	const allFieldsFormattedToXML = extractXMLValueAndFormatForRequest(arrayOfFieldsToXML);

	const body = formatAsXMLSOAPBody(allFieldsFormattedToXML, 'MTS_GetTransactionID');

	const axiosConfig = getAxiosConfig(body);

	const res = await axios.request(axiosConfig);

	if (res.status !== 200) throw new Error('response not ok' + res.statusText);

	return res.data;
}

function prepareInputObject({ Addendum1, Addendum1Settl, PAN, Expiry, TransSum, Payments, CreditTerms, CVV2, ID, TransactionID }) {
	if (!Addendum1) {
		throw new Error('illegal body, missing Addendum');
	}

	const input = {
		Addendum1,
		Addendum1Settl,
		PAN,
		Expiry,
		TransactionID,
		TransSum,
		Payments: Payments ?? dynamicParameters.Payments,
		CreditTerms: CreditTerms ?? dynamicParameters.CreditTerms,
		CVV2: CVV2 ?? dynamicParameters.CVV2,
		ID: ID ?? dynamicParameters.ID,
	};

	if (needsToProvideCVVAndIsraeliID) {
		if (!CVV2 || !ID) {
			throw new Error('illegal body, missing CVV2 or ID');
		}
		input.CVV2 = CVV2;
		input.ID = ID;
	}

	return input;
}

function getArrayOfMappedFieldsToValues(input) {
	const emptyFieldsFormatted = mapArrayOfFieldsToXML({ fields: emptyFields, objectKeys: false, store: {} });
	const staticParametersFormatted = mapArrayOfFieldsToXML({ fields: Object.keys(staticParameters), objectKeys: true, store: staticParameters });
	const inputFieldsFormatted = mapArrayOfFieldsToXML({ fields: Object.keys(input), objectKeys: true, store: input });

	return [...inputFieldsFormatted, ...staticParametersFormatted, ...emptyFieldsFormatted];
}
