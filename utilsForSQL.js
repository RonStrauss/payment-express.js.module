//@ts-check
const sql = require('mssql');
const { executeQuery } = require('../../DB/main');
/**
 * @type {{order: 'TeudaNum', receipt: 'DocNum'}}
 */
const identifierRecord = {
	order: 'TeudaNum',
	receipt: 'DocNum',
};
const totalSumRecord = {
	order: 'TeudaTotalSum',
	receipt: 'DocTotal',
};
module.exports = {
	checkValidityOfInitialPayload,
	checkIfDocAlreadyPaidInLocalDB,
	insertNewOrderWithPayment,
	checkIfDocAlreadyExistsInDB,
	identifierRecord,
	totalSumRecord,
	deconstructIdentifiers,
};

/**
 *
 * @param {keyof typeof identifierRecord} mode
 * @param {Express.Request & {body: any}} req
 * @returns {boolean}
 */
function checkValidityOfInitialPayload(mode, req) {
	if (!req.body) return false;

	let arrayOfPropertiesThatMustExist = ['PAN', 'Expiry', 'TransSum', 'CreditTerms', 'Payments'];
	if (mode === 'order') {
		arrayOfPropertiesThatMustExist = [
			...arrayOfPropertiesThatMustExist,
			'DATAString',
			'TeudaType',
			'TeudaNum',
			'AgentID',
			'Client_Name',
			'TeudaTotalSum',
			'TotalLines',
			'TeudaRemark',
			'Company',
			'Status',
		];
	}

	if (mode === 'receipt') {
		arrayOfPropertiesThatMustExist = [
			...arrayOfPropertiesThatMustExist,
			'DocNum',
			'CreateDate',
			'DocTotal',
			'ClientID',
			'AgentID',
			'Company',
			'TeudaStatus',
			'receiptArray',
		];
	}

	for (const prop of arrayOfPropertiesThatMustExist) {
		if (req.body[prop] == null) return false;
	}
	return true;
}

/**
 *
 * @param {string} docIdentifier string to lookup
 * @param {'receipt' | 'order'} mode which table to look in
 * @returns Promise<boolean>
 */
async function checkIfDocAlreadyExistsInDB(docIdentifier, mode) {
	let result = false;
	try {
		if (mode === 'order') {
			const { recordset } = await sql.query`SELECT * FROM MSFDB.dbo.TDataOneString WHERE TeudaNum = ${docIdentifier}`;
			result = recordset.length > 0;
		}

		if (mode === 'receipt') {
			const { recordset } = await sql.query`SELECT * FROM [MSFDB].[dbo].[TRecipts] WHERE DocNum = ${docIdentifier}`;
			result = recordset.length > 0;
		}
	} catch (err) {
		return false;
	}
	return result;
}

/**
 * @param {Express.Request & {body: any}} req
 * @param {Express.Response} res
 * @param {any} paymentDetails
 */
function insertNewOrderWithPayment(req, res, paymentDetails) {
	const query = `INSERT INTO MSFDB.dbo.TDataOneString( DATAString, TeudaType, TeudaNum, AgentID, Client_Name, TeudaTotalSum, TotalLines, TeudaRemark, Company, Status ) VALUES ( @DATATEST, @TeudaType, @TeudaNum, @AgentID, @Client_Name, @TeudaTotalSum, @TotalLines, @TeudaRemark, @Company, @Status )`;

	const DATAString = JSON.parse(req.body.DATAString);
	DATAString.Payments = paymentDetails;
	const updatedDATAString = JSON.stringify(DATAString);

	const parameters = [
		{ name: 'DATATEST', sqltype: sql.NVarChar, value: updatedDATAString },
		{ name: 'TeudaType', sqltype: sql.Int, value: req.body.TeudaType },
		{ name: 'TeudaNum', sqltype: sql.NVarChar, value: req.body.TeudaNum },
		{ name: 'AgentID', sqltype: sql.NVarChar, value: req.body.AgentID },
		{ name: 'Client_Name', sqltype: sql.NVarChar, value: req.body.Client_Name },
		{ name: 'TeudaTotalSum', sqltype: sql.Decimal(18, 3), value: req.body.TeudaTotalSum },
		{ name: 'TotalLines', sqltype: sql.Int, value: req.body.TotalLines },
		{ name: 'TeudaRemark', sqltype: sql.NVarChar, value: req.body.TeudaRemark },
		{ name: 'Company', sqltype: sql.Int, value: req.body.Company },
		{ name: 'Status', sqltype: sql.NVarChar, value: req.body.Status },
	];

	executeQuery(res, query, parameters);
}

/**
 *
 * @param {string} docIdentifier
 * @returns {Promise<sql.IRecordSet<any>>}
 */
async function checkIfDocAlreadyPaidInLocalDB(docIdentifier) {
	if (!docIdentifier) throw new Error('docIdentifier is required');
	const query = `SELECT * FROM [MSFDB].[dbo].[CreditTransaction] WHERE TeudaNum = '${docIdentifier}'`;
	const result = await sql.query(query);
	return result.recordset;
}

/**
 * @param {*} body
 * @param {keyof typeof identifierRecord} mode
 * @returns {{identifier:typeof identifierRecord[keyof typeof identifierRecord], totalSum:number}}
 */
function deconstructIdentifiers(body, mode) {
	const identifier = body[identifierRecord[mode]];
	const totalSum = body[totalSumRecord[mode]];
	return { identifier, totalSum };
}
