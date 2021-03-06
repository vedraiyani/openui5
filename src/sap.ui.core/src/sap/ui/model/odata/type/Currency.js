/*!
 * ${copyright}
 */

// Provides an OData Currency type which extends sap.ui.model.type.Currency by currency customizing
sap.ui.define([
	"sap/ui/model/ParseException",
	"sap/ui/model/ValidateException",
	"sap/ui/model/type/Currency"
], function (ParseException, ValidateException, BaseCurrency) {
	"use strict";
	/*global Map */

	var mCustomizing2CustomCurrencies = new Map(),
		rDecimal = /\.(\d+)$/;

	/**
	 * Fetches a text from the message bundle and formats it using the parameters.
	 *
	 * @param {string} sKey
	 *   The message key
	 * @param {any[]} aParams
	 *   The message parameters
	 * @returns {string}
	 *   The message
	 */
	function getText(sKey, aParams) {
		return sap.ui.getCore().getLibraryResourceBundle().getText(sKey, aParams);
	}

	/**
	 * Constructor for a <code>Currency</code> composite type.
	 *
	 * @param {object} [oFormatOptions]
	 *   See parameter <code>oFormatOptions</code> of
	 *   {@link sap.ui.model.type.Currency#constructor}. Format options are immutable, that is, they
	 *   can only be set once on construction.
	 * @param {object} [oFormatOptions.customCurrencies]
	 *   Not supported; the type derives this from its currency customizing part.
	 * @param {boolean} [oFormatOptions.parseAsString=true]
	 *   Whether the amount is parsed to a string; set to <code>false</code> if the amount's
	 *   underlying type is represented as a <code>number</code>, for example
	 *   {@link sap.ui.model.odata.type.Int32}
	 * @param {object} [oConstraints] Not supported
	 * @throws {Error} If called with more parameters than <code>oFormatOptions</code> or if the
	 *   format option <code>customCurrencies</code> is set
	 *
	 * @alias sap.ui.model.odata.type.Currency
	 * @author SAP SE
	 * @class This class represents the <code>Currency</code> composite type with the parts amount,
	 * currency, and currency customizing. The amount part is formatted according to the customizing
	 * for the currency. Use the result of the promise returned by
	 * {@link sap.ui.model.odata.v4.ODataMetaModel#requestCurrencyCodes} as currency customizing
	 * part. If no currency customizing is available, UI5's default formatting applies. The type may
	 * only be used for amount and currency parts from a {@link sap.ui.model.odata.v4.ODataModel}.
	 * @extends sap.ui.model.type.Currency
	 * @public
	 * @since 1.63.0
	 * @version ${version}
	 */
	var Currency = BaseCurrency.extend("sap.ui.model.odata.type.Currency", {
		constructor : function (oFormatOptions, oConstraints, aDynamicFormatOptionNames) {
			if (oFormatOptions && oFormatOptions["customCurrencies"]) {
				throw new Error("Format option customCurrencies is not supported");
			}

			if (oConstraints) {
				throw new Error("Constraints not supported");
			}

			if (arguments.length > 2) {
				throw new Error("Only the parameter oFormatOptions is supported");
			}

			// Note: The format option 'parseAsString' is always set to true, so that the base type
			// always parses to a string and we can check the result.
			this.bParseAsString = !oFormatOptions || !("parseAsString" in oFormatOptions)
				|| oFormatOptions.parseAsString;
			oFormatOptions = Object.assign({}, oFormatOptions, {parseAsString : true});

			BaseCurrency.call(this, oFormatOptions, oConstraints);

			this.bParseWithValues = true;

			// must not overwrite setConstraints and setFormatOptions on prototype as they are
			// called in SimpleType constructor
			this.setConstraints = function () {
				throw new Error("Constraints not supported");
			};
			this.setFormatOptions = function () {
				throw new Error("Format options are immutable");
			};
			this.mCustomCurrencies = undefined;
		}
	});

	/**
	 * Formats the given values of the parts of the <code>Currency</code> composite type to the
	 * given target type.
	 *
	 * @param {any[]} aValues
	 *   Array of part values to be formatted; contains amount, currency, currency customizing in
	 *   this order. The first call to this method where all parts are set determines the currency
	 *   customizing; subsequent calls use this customizing, so that the corresponding part may be
	 *   omitted. Changes to the currency customizing part after this first method call are not
	 *   considered: The currency customizing for this <code>Currency</code> instance remains
	 *   unchanged.
	 * @param {string} sTargetType
	 *   The target type; must be "string" or a type with "string" as its
	 *   {@link sap.ui.base.DataType#getPrimitiveType primitive type}.
	 *   See {@link sap.ui.model.odata.type} for more information.
	 * @returns {string}
	 *   The formatted output value; <code>null</code>, if <code>aValues</code> is
	 *   <code>undefined</code> or <code>null</code> or if the amount, the currency or
	 *   the currency customizing contained therein is <code>undefined</code>.
	 * @throws {sap.ui.model.FormatException}
	 *   If <code>sTargetType</code> is unsupported
	 *
	 * @public
	 * @since 1.63.0
	 */
	Currency.prototype.formatValue = function (aValues, sTargetType) {
		var that = this;

		if (this.mCustomCurrencies === undefined && aValues && aValues[2] !== undefined) {
			if (aValues[2] === null) { // no currency customizing available
				this.mCustomCurrencies = null;
			} else {
				this.mCustomCurrencies = mCustomizing2CustomCurrencies.get(aValues[2]);
				if (!this.mCustomCurrencies) {
					this.mCustomCurrencies = {};
					Object.keys(aValues[2]).forEach(function (sKey) {
						that.mCustomCurrencies[sKey] = {
							decimals : aValues[2][sKey].UnitSpecificScale,
							isoCode : aValues[2][sKey].StandardCode
						};
					});
					mCustomizing2CustomCurrencies.set(aValues[2], this.mCustomCurrencies);
				}
				BaseCurrency.prototype.setFormatOptions.call(this,
					Object.assign({customCurrencies : this.mCustomCurrencies},
						this.oFormatOptions));
			}
		}

		// composite binding calls formatValue several times, where some parts are not yet available
		if (!aValues || aValues[0] === undefined || aValues[1] === undefined
			|| this.mCustomCurrencies === undefined && aValues[2] === undefined) {
			return null;
		}

		return BaseCurrency.prototype.formatValue.call(this, aValues.slice(0, 2), sTargetType);
	};

	/**
	 * @see sap.ui.base.Object#getInterface
	 *
	 * @returns {object} this
	 *
	 * @public
	 * @since 1.63.0
	 */
	Currency.prototype.getInterface = function () {
		return this;
	};

	/**
	 * Returns the type's name.
	 *
	 * @returns {string}
	 *   The type's name
	 *
	 * @public
	 * @since 1.63.0
	 */
	Currency.prototype.getName = function () {
		return "sap.ui.model.odata.type.Currency";
	};

	/**
	 * Parses the given string value to an array containing amount and currency.
	 *
	 * @param {string} vValue
	 *   The value to be parsed
	 * @param {string} sSourceType
	 *   The source type (the expected type of <code>vValue</code>); must be "string", or a type
	 *   with "string" as its
	 *   {@link sap.ui.base.DataType#getPrimitiveType primitive type}.
	 *   See {@link sap.ui.model.odata.type} for more information.
	 * @param {any[]} aCurrentValues
	 *   The current values of all binding parts
	 * @returns {any[]}
	 *   An array containing amount and currency in this order. Both, amount and currency, are
	 *   string values unless the format option <code>parseAsString</code> is <code>false</code>; in
	 *   this case, the amount is a number.
	 * @throws {sap.ui.model.ParseException}
	 *   If {@link #formatValue} has not yet been called with a currency customizing part or
	 *   if <code>sSourceType</code> is unsupported or if the given string cannot be parsed
	 *
	 * @public
	 * @see sap.ui.model.type.Currency#parseValue
	 * @since 1.63.0
	 */
	Currency.prototype.parseValue = function (vValue, sSourceType, aCurrentValues) {
		var sCurrency, iDecimals, iFractionDigits, aMatches, aValues;

		if (this.mCustomCurrencies === undefined) {
			throw new ParseException("Cannot parse value without currency customizing");
		}

		aValues = BaseCurrency.prototype.parseValue.apply(this, arguments);
		sCurrency = aValues[1] || aCurrentValues[1];
		// remove trailing decimal zeroes and separator
		if (aValues[0].includes(".")) {
			aValues[0] = aValues[0].replace(/0+$/, "").replace(/\.$/, "");
		}
		if (sCurrency && this.mCustomCurrencies) {
			aMatches = rDecimal.exec(aValues[0]);
			iFractionDigits = aMatches ? aMatches[1].length : 0;
			// If the currency is not in mCustomCurrencies, the base class throws a ParseException.
			iDecimals = this.mCustomCurrencies[sCurrency].decimals;
			if (iFractionDigits > iDecimals) {
				throw new ParseException(iDecimals
					? getText("EnterNumberFraction", [iDecimals])
					: getText("EnterInt"));
			}
		}
		if (!this.bParseAsString) {
			aValues[0] = Number(aValues[0]);
		}

		return aValues;
	};

	/**
	 * Does nothing as the <code>Currency</code> type does not support constraints.
	 *
	 * @param {string} vValue
	 *   The value to be validated
	 * @returns {void}
	 * @throws {sap.ui.model.ValidateException}
	 *   If {@link #formatValue} has not yet been called with a currency customizing part
	 *
	 * @public
	 * @since 1.63.0
	 */
	Currency.prototype.validateValue = function (vValue) {
		if (this.mCustomCurrencies === undefined) {
			throw new ValidateException("Cannot validate value without currency customizing");
		}
	};

	return Currency;
});