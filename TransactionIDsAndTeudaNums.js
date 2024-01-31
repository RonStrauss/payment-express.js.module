//@ts-check
class TransactionIDStore {
	/**
	 * @type {{[key: string]: string|null}}
	 */
	#store = {};
	constructor() {}

	addOnlyTeudaNum(Addendum1) {
		this.#store[Addendum1] = null;
	}

	add({ TransactionID, Addendum1 }) {
		this.#store[Addendum1] = TransactionID;
	}

	has(Addendum1) {
		return Addendum1 in this.#store;
	}

	get(Addendum1) {
		return this.#store[Addendum1];
	}

	getAddendum1(TransactionID) {
		return Object.keys(this.#store).find((key) => this.#store[key] === TransactionID);
	}

	remove(Addendum1) {
		delete this.#store[Addendum1];
	}
}

module.exports = new TransactionIDStore();
