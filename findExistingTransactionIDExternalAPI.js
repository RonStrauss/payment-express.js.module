//@ts-check
const creditParameters = require('./parameters');
const axios = require('axios').default;
const { mapArrayOfFieldsToXML, extractXMLValueAndFormatForRequest, formatAsXMLSOAPBody, getAxiosConfig } = require('./utils');

const isDevelopment = process.env.NODE_ENV === 'development';

const emptyFields = ['anXML', 'cNote', 'mNote'];
const method = 'MTS_EMV_RetakeTrans_XML_Notes';
const checkTransactionParameters = [
	{ field: 'TerminalNum', value: creditParameters.identifier },
	{ field: 'TerminalPassword', value: creditParameters.identifier },
	...emptyFields.map((field) => ({ field })),
];

module.exports = async (TransactionID) => {
	const parameters = [...checkTransactionParameters.slice(0, 2), { field: 'TransID', value: TransactionID }, ...checkTransactionParameters.slice(2)];
	const allFieldsMapped = getArrayOfMappedFieldsToValues(parameters);

	const allFieldsFormattedToXML = extractXMLValueAndFormatForRequest(allFieldsMapped);

	const body = formatAsXMLSOAPBody(allFieldsFormattedToXML, method);

	const axiosConfig = getAxiosConfig(body);

	const res = await axios(axiosConfig);

	if (res.status !== 200) throw new Error('response not ok' + res.statusText);

	return res.data;
};

function getArrayOfMappedFieldsToValues(parameters) {
	const store = parameters.reduce((acc, curr) => {
		acc[curr.field] = curr.value || '';
		return acc;
	}, {});
	return mapArrayOfFieldsToXML({ fields: Object.keys(store), objectKeys: true, store });
}
