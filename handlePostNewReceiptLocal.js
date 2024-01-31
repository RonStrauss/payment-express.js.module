const sql = require('mssql');
const { config } = require('../../DB/main');
const express = require('express');

/**
 * @param {express.Request} req
 * @param {express.Response} res
 */
module.exports = async (req, res) => {
	const staticValues = ['DocNum', 'CreateDate', 'DocTotal', 'ClientID', 'AgentID', 'Company', 'TeudaStatus', 'ClientEmail'];

	const columns = [
		...staticValues,
		'Sug',
		'CheckNum',
		'Bank',
		'Snif',
		'AccountNum',
		'PayTotal',
		'PayDate',
		'PayRemark',
		'DocRemark',
		'HeshNum',
		'HeshType',
		'HexhSUm',
		'Payments',
	];

	const { DocTotal, Payments } = req.body;
	let { receiptArray } = req.body;
	receiptArray = fixPaymentsForSug4(receiptArray, Payments);

	if (DocTotal === 0) {
		return res.status(400).send({ success: false, msg: 'total cannot be 0' });
	}

	const pool = await sql.connect(config);

	const request = new sql.Request();

	try {
		for (const i in receiptArray) {
			const entry = receiptArray[i];
			const paramsArr = Object.entries(entry).map((valueArr) => {
				if (!columns.includes(valueArr[0])) {
					throw 'Illegal column detected';
				}

				let type = sql.NVarChar;

				if (valueArr[0] === 'PayDate') type = sql.Date;
				if (valueArr[0] === 'Sug' || valueArr[0] === 'Payments') type = sql.Int;
				if (['PayTotal', 'HexhSUm'].includes(valueArr[0])) type = sql.Decimal(18, 2);

				return [valueArr[0] + i, type, valueArr[1]];
			});

			for (const inp of paramsArr) {
				request.input(...inp);
			}
		}

		for (const str of staticValues) {
			let type = sql.NVarChar;

			if (str === 'CreateDate') type = sql.Date;
			if (str === 'DocTotal') type = sql.Decimal(18, 2);
			if (['TeudaStatus', 'Company'].includes(str)) type = sql.Int;

			request.input(str, type, req.body[str]);
		}

		let query = `INSERT INTO [MSFDB].[dbo].[TRecipts] (${columns.toString()},DocType) values `;

		const nonStaticValues = columns.slice(staticValues.length);

		for (const i in receiptArray) {
			query += `(${staticValues.map((v) => '@' + v).toString()},${nonStaticValues.map((v) => '@' + v + i)},32)`;

			if (i < receiptArray.length - 1) {
				query += ',';
			}
		}

		const results = await request.query(query);

		return res.send({ results });
	} catch (err) {
		console.log(err);
		return res.status(500).send({ err: true, msg: 'Internal server error', reason: { name: err.name, message: err.message } });
	}
};

function fixPaymentsForSug4(receiptsArray, Payments) {
	return receiptsArray.map((receipt) => {
		return {
			...receipt,
			Payments: receipt.Sug === 4 && Payments > 1 ? Payments : 1,
		};
	});
}
