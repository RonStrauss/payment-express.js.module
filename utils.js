//@ts-check
const parameters = require('./parameters');
const { desiredXMLOrder, apiEndpoint, methodName, xmlns } = parameters;
module.exports = {
	checkIfTotalSumMatchesAcceptableDifference,
	orderXMLArray,
	extractXMLValueAndFormatForRequest,
	getAxiosConfig,
	formatAsXMLSOAPBody,
	formatAsXMLField,
	mapArrayOfFieldsToXML,
};

/**
 * @param {{field: string, xml:string}[]} xmlArray
 * @returns {{field: string, xml:string}[]} xmlArray
 */
function orderXMLArray(xmlArray) {
	const xmlOrder = desiredXMLOrder;

	return xmlArray.sort((a, b) => {
		const indexA = xmlOrder.indexOf(a.field);
		const indexB = xmlOrder.indexOf(b.field);
		return indexA - indexB;
	});
}

/**
 * @param {{ xml: string}[]} mappedArray
 * @returns {string}
 */
function extractXMLValueAndFormatForRequest(mappedArray) {
	return mappedArray.map((f) => f.xml).join('\n' + '\t'.repeat(4));
}

/**
 * @param {*} body
 * @returns {import('axios').AxiosRequestConfig}
 */
function getAxiosConfig(body) {
	return {
		method: 'post',
		maxBodyLength: Infinity,
		url: apiEndpoint,
		headers: {
			'Content-Type': 'application/soap+xml; charset=utf-8',
			'Sent-From': 'Mobility',
		},
		data: body,
		timeout: 8000,
		timeoutErrorMessage: parameters.axiosErrorMessages.timeout,
	};
}

/**
 * @param {{fields: string[], objectKeys: boolean, store: any}}
 * @returns {{field: string, xml: string}[]}
 */
function mapArrayOfFieldsToXML({ fields, objectKeys, store }) {
	return fields.map((field) => {
		return {
			field,
			xml: formatAsXMLField(field, objectKeys ? store[field] : ''),
		};
	});
}

/**
 * @param {string} body
 * @param {string} method
 * @returns {string}
 */
function formatAsXMLSOAPBody(body, method = methodName) {
	return `<?xml version="1.0" encoding="utf-8"?>
	<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
		 <soap12:Body>
			<${method} xmlns="${xmlns}">
				${body}
			</${method}>
		</soap12:Body>
	</soap12:Envelope>`;
}

/**
 * @param {string} field
 * @param {string} value
 * @returns {string}
 */
function formatAsXMLField(field, value = '') {
	return `<${field}>${value}</${field}>`;
}

function checkIfTotalSumMatchesAcceptableDifference(totalSum, expectedSum) {
	// payment might be rounded up or down, so we allow a difference of 0.1
	// for example, .444 will be rounded to .44, and .445 will be rounded to .45, which is acceptable
	return Math.abs(totalSum - expectedSum) < 0.1;
}

/**
 * @typedef {'order'|'receipt'} PaymentModes
 */
