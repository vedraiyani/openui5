sap.ui.define([
	'sap/ui/layout/VerticalLayout',
	'sap/m/Button',
	'sap/ui/dt/test/report/QUnit',
	'sap/ui/dt/test/ElementEnablementTest',
	'sap/ui/rta/test/controlEnablingCheck'
], function(VerticalLayout, Button, QUnitReport, ElementEnablementTest, rtaControlEnablingCheck) {
	"use strict";

	var oElementEnablementTest = new ElementEnablementTest({
		type : "sap.ui.layout.VerticalLayout",
		create : function () {
			return new VerticalLayout({
				content : [new Button({text:"test"})]
			});
		}
	});

	return oElementEnablementTest.run()

	.then(function(oData) {
		new QUnitReport({
			data: oData
		});
	})

	.then(function() {
		// Move action
		var fnConfirmElement1IsOn3rdPosition = function (oUiComponent, oViewAfterAction, assert) {
			assert.strictEqual(oViewAfterAction.byId("button1").getId(),
					oViewAfterAction.byId("layout").getContent()[2].getId(),
					"then the control has been moved to the right position");
		};
		var fnConfirmElement1IsOn1stPosition = function (oUiComponent, oViewAfterAction, assert) {
			assert.strictEqual(oViewAfterAction.byId("button1").getId(),
					oViewAfterAction.byId("layout").getContent()[0].getId(),
					"then the control has been moved to the previous position");
		};

		rtaControlEnablingCheck("Checking the move action for a VerticalLayout control", {
			xmlView: '<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:l="sap.ui.layout">' +
				'<l:VerticalLayout id="layout">' +
					'<m:Button text="Button 1" id="button1" />' +
					'<m:Button text="Button 2" id="button2" />' +
					'<m:Button text="Button 3" id="button3" />' +
				'</l:VerticalLayout>' +
			'</mvc:View>'
			,
			action: {
				name: "move",
				controlId: "layout",
				parameter: function (oView) {
					return {
						movedElements: [{
							element: oView.byId("button1"),
							sourceIndex: 0,
							targetIndex: 2
						}],
						source: {
							aggregation: "content",
							parent: oView.byId("layout")
						},
						target: {
							aggregation: "content",
							parent: oView.byId("layout")
						}
					};
				}
			},
			afterAction: fnConfirmElement1IsOn3rdPosition,
			afterUndo: fnConfirmElement1IsOn1stPosition,
			afterRedo: fnConfirmElement1IsOn3rdPosition
		});

		// Remove and reveal actions
		var fnConfirmLayoutIsInvisible = function (oUiComponent, oViewAfterAction, assert) {
			assert.strictEqual(oViewAfterAction.byId("layout").getVisible(), false, "then the Layout element is invisible");
		};

		var fnConfirmLayoutIsVisible = function (oUiComponent, oViewAfterAction, assert) {
			assert.strictEqual(oViewAfterAction.byId("layout").getVisible(), true, "then the Layout is visible");
		};

		rtaControlEnablingCheck("Checking the remove and reveal actions for VerticalLayout control", {
			xmlView: '<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:l="sap.ui.layout">' +
				'<l:VerticalLayout id="layout">' +
					'<m:Text text="Text" id="text1" />' +
				'</l:VerticalLayout>' +
			'</mvc:View>'
			,
			action: {
				name: "remove",
				controlId: "layout",
				parameter: function (oView) {
					return {
						removedElement: oView.byId("layout")
					};
				}
			},
			afterAction: fnConfirmLayoutIsInvisible,
			afterUndo: fnConfirmLayoutIsVisible,
			afterRedo: fnConfirmLayoutIsInvisible
		});
	});
});