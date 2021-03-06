/*!
 * ${copyright}
 */

// Provides control sap.m.SinglePlanningCalendarGrid.
sap.ui.define([
		'./SinglePlanningCalendarUtilities',
		'sap/ui/core/Control',
		'sap/ui/core/LocaleData',
		'sap/ui/core/Locale',
		'sap/ui/core/InvisibleText',
		'sap/ui/core/format/DateFormat',
		'sap/ui/core/date/UniversalDate',
		'sap/ui/core/dnd/DragInfo',
		'sap/ui/core/dnd/DropInfo',
		'sap/ui/core/dnd/DragDropInfo',
		'sap/ui/unified/library',
		'sap/ui/unified/calendar/DatesRow',
		'sap/ui/unified/calendar/CalendarDate',
		'sap/ui/unified/calendar/CalendarUtils',
		'sap/ui/events/KeyCodes',
		'./SinglePlanningCalendarGridRenderer',
		'sap/ui/Device'
	],
	function (
		SinglePlanningCalendarUtilities,
		Control,
		LocaleData,
		Locale,
		InvisibleText,
		DateFormat,
		UniversalDate,
		DragInfo,
		DropInfo,
		DragDropInfo,
		unifiedLibrary,
		DatesRow,
		CalendarDate,
		CalendarUtils,
		KeyCodes,
		SinglePlanningCalendarGridRenderer,
		Device
	) {
		"use strict";

		var ROW_HEIGHT_COZY = 69,
			ROW_HEIGHT_COMPACT = 48,
			BLOCKER_ROW_HEIGHT_COZY = 34,
			BLOCKER_ROW_HEIGHT_COMPACT = 25,
			HALF_HOUR_MS = 3600000 / 2,
			ONE_MIN_MS = 60 * 1000,
			MILLISECONDS_IN_A_DAY = 86400000,
			RESIZE_CONFIG_NAME = "ResizeConfig";

		/**
		 * Constructor for a new SinglePlanningCalendarGrid.
		 *
		 * @param {string} [sId] id for the new control, generated automatically if no id is given
		 * @param {object} [mSettings] initial settings for the new control
		 *
		 * @class
		 * Disclaimer: This control is in a beta state - incompatible API changes may be done before its official public release. Use at your own discretion.
		 *
		 * <h3>Overview</h3>
		 *
		 * Displays a grid in which appointments are rendered.
		 *
		 * <b>Note:</b> The <code>PlanningCalendarGrid</code> uses parts of the <code>sap.ui.unified</code> library.
		 * This library will be loaded after the <code>PlanningCalendarGrid</code>, if it wasn't previously loaded.
		 * This could lead to a waiting time when a <code>PlanningCalendarGrid</code> is used for the first time.
		 * To prevent this, apps using the <code>PlanningCalendarGrid</code> must also load the
		 * <code>sap.ui.unified</code> library.
		 *
		 * <h3>Usage</h3>
		 *
		 * The <code>PlanningCalendarGrid</code> has the following structure:
		 *
		 * <ul>
		 *     <li>Each column in the grid represents a single entity of the view type. For example in the week view one
		 *     column represents a week day.</li>
		 *     <li>Each row represents an hour from each day.</li>
		 *     <li>There are also appointments displayed across the grid. To display an all-day appointment, the
		 *     appointment must start at 00:00 and end on any day in the future in 00:00h.</li>
		 * </ul>
		 *
		 * @extends sap.ui.core.Control
		 *
		 * @author SAP SE
		 * @version ${version}
		 *
		 * @constructor
		 * @private
		 * @since 1.61
		 * @alias sap.m.SinglePlanningCalendarGrid
		 */

		var SinglePlanningCalendarGrid = Control.extend("sap.m.SinglePlanningCalendarGrid", /** @lends sap.m.SinglePlanningCalendarGrid.prototype */ {
			metadata: {

				library: "sap.m",

				properties: {

					/**
					 * Determines the start date of the grid, as a JavaScript date object. It is considered as a local date.
					 * The time part will be ignored. The current date is used as default.
					 */
					startDate: {type: "object", group: "Data"},

					/**
					 * Determines whether the appointments in the grid are draggable.
					 *
					 * The drag and drop interaction is visualized by a placeholder highlighting the area where the
					 * appointment can be dropped by the user.
					 *
					 * @since 1.64
					 */
					enableAppointmentsDragAndDrop: { type: "boolean", group: "Misc", defaultValue: false },

					/**
					 * Determines whether the appointments are resizable.
					 *
					 * The resize interaction is visualized by making the appointment transparent.
					 *
					 * The appointment snaps on every interval
					 * of 30 minutes. After the resize is finished, the {@link #event:appointmentResize appointmentResize} event is fired, containing
					 * the new start and end JavaScript date objects.
					 *
					 * @since 1.65
					 */
					enableAppointmentsResize: { type: "boolean", group: "Misc", defaultValue: false }
				},
				aggregations: {

					/**
					 * The appointments to be displayed in the grid. Appointments outside the visible time frame are not rendered.
					 * Appointments, longer than a day, will be displayed in all of the affected days.
					 * An appointment which starts at 00:00 and ends in 00:00 on any day in the future is displayed as an all-day
					 * appointment.
					 */
					appointments: {type: "sap.ui.unified.CalendarAppointment", multiple: true, singularName: "appointment", dnd : {draggable: true}},

					/**
					 * Hidden, for internal use only.
					 * The date row which shows the header of the columns in the <code>SinglePlanningCalendarGrid</code>.
					 *
					 * @private
					 */
					_columnHeaders: {type: "sap.ui.unified.calendar.DatesRow", multiple: false, visibility: "hidden"},

					_intervalPlaceholders : {type : "sap.m.SinglePlanningCalendarGrid._internal.IntervalPlaceholder", multiple : true, visibility : "hidden", dnd : {droppable: true}},
					_blockersPlaceholders : {type : "sap.m.SinglePlanningCalendarGrid._internal.IntervalPlaceholder", multiple : true, visibility : "hidden", dnd : {droppable: true}}

				},
				associations: {

					/**
					 * Association to controls / IDs which label this control (see WAI-ARIA attribute aria-labelledby).
					 *
					 * <b>Note</b> These labels are also assigned to the appointments.
					 */
					ariaLabelledBy: {type: "sap.ui.core.Control", multiple: true, singularName: "ariaLabelledBy"}

				},
				events: {

					/**
					 * Fired if an appointment is selected.
					 */
					appointmentSelect: {
						parameters: {

							/**
							 * The selected appointment.
							 */
							appointment: {type: "sap.ui.unified.CalendarAppointment"}

						}
					},

					/**
					 * Fired if an appointment is dropped.
					 * @since 1.64
					 */
					appointmentDrop : {
						parameters : {
							/**
							 * The dropped appointment.
							 */
							appointment : {type : "sap.ui.unified.CalendarAppointment"},

							/**
							 * Start date of the dropped appointment, as a JavaScript date object.
							 */
							startDate : {type : "object"},

							/**
							 * Dropped appointment end date as a JavaScript date object.
							 */
							endDate : {type : "object"},

							/**
							 * The drop type. If true - it's "Copy", if false - it's "Move".
							 */
							copy : {type : "boolean"}
						}
					},

				/**
				 * Fired if an appointment is resized.
				 * @since 1.65
				 */
					appointmentResize: {
						parameters: {
							/**
							 * The dropped appointment.
							 */
							appointment: { type: "sap.ui.unified.CalendarAppointment" },

							/**
							 * Start date of the dropped appointment, as a JavaScript date object.
							 */
							startDate: { type: "object" },

							/**
							 * Dropped appointment end date as a JavaScript date object.
							 */
							endDate: { type: "object" }
						}
					}
				}
			}
		});

		SinglePlanningCalendarGrid.prototype.init = function () {
			var oStartDate = new Date(),
				oDatesRow = new DatesRow(this.getId() + "-columnHeaders", {
					showDayNamesLine: false,
					showWeekNumbers: false,
					startDate: oStartDate
				}).addStyleClass("sapMSinglePCColumnHeader"),
				iDelay = (60 - oStartDate.getSeconds()) * 1000;

			this.setAggregation("_columnHeaders", oDatesRow);
			this.setStartDate(oStartDate);
			this._setColumns(7);
			this._configureBlockersDragAndDrop();
			this._configureAppointmentsDragAndDrop();
			this._configureAppointmentsResize();

			this._oUnifiedRB = sap.ui.getCore().getLibraryResourceBundle("sap.ui.unified");
			this._oFormatAria = DateFormat.getDateTimeInstance({
				pattern: "EEEE dd/MM/YYYY 'at' HH:mm:ss a"
			});

			setTimeout(this._updateRowHeaderAndNowMarker.bind(this), iDelay);
		};

		SinglePlanningCalendarGrid.prototype.onBeforeRendering = function () {
			var oAppointmentsMap = this._createAppointmentsMap(this.getAppointments()),
				oStartDate = this.getStartDate(),
				oCalStartDate = CalendarDate.fromLocalJSDate(oStartDate),
				iColumns = this._getColumns();

			this._oVisibleAppointments = this._calculateVisibleAppointments(oAppointmentsMap.appointments, this.getStartDate(), iColumns);
			this._oAppointmentsToRender = this._calculateAppointmentsLevelsAndWidth(this._oVisibleAppointments);
			this._aVisibleBlockers = this._calculateVisibleBlockers(oAppointmentsMap.blockers, oCalStartDate, iColumns);
			this._oBlockersToRender = this._calculateBlockersLevelsAndWidth(this._aVisibleBlockers);

			if (this._iOldColumns !== iColumns || this._oOldStartDate !== oStartDate) {
				this._createBlockersDndPlaceholders(oStartDate, iColumns);
				this._createAppointmentsDndPlaceholders(oStartDate, iColumns);
			}
		};

		SinglePlanningCalendarGrid.prototype.onmousedown = function(oEvent) {
			var oClassList = oEvent.target.classList;
			this._isResizeHandleBottomMouseDownTarget = oClassList.contains("sapMSinglePCAppResizeHandleBottom");
			this._isResizeHandleTopMouseDownTarget = oClassList.contains("sapMSinglePCAppResizeHandleTop");
		};

		SinglePlanningCalendarGrid.prototype._isResizingPerformed = function() {
			return this._isResizeHandleBottomMouseDownTarget || this._isResizeHandleTopMouseDownTarget;
		};

		SinglePlanningCalendarGrid.prototype._configureBlockersDragAndDrop = function () {
			this.addDragDropConfig(new DragDropInfo({
				sourceAggregation: "appointments",
				targetAggregation: "_blockersPlaceholders",

				dragStart: function (oEvent) {
					if (!this.getEnableAppointmentsDragAndDrop()) {
						oEvent.preventDefault();
						return false;
					}
					var fnHandleAppsOverlay = function () {
						var $Overlay = jQuery(".sapMSinglePCOverlay");

						setTimeout(function () {
							$Overlay.addClass("sapMSinglePCOverlayDragging");
						});

						jQuery(document).one("dragend", function () {
							$Overlay.removeClass("sapMSinglePCOverlayDragging");
						});
					};

					fnHandleAppsOverlay();
				}.bind(this),

				dragEnter: function (oEvent) {
					var oDragSession = oEvent.getParameter("dragSession"),
						oAppointment = oDragSession.getDragControl(),
						oDropTarget = oDragSession.getDropControl(),
						bIsFullDay = this.isAllDayAppointment(oAppointment.getStartDate(), oAppointment.getEndDate()),
						fnAlignIndicator = function () {
							var $Indicator = jQuery(oDragSession.getIndicator()),
								iAppHeight = oAppointment.$().outerHeight(),
								iAppWidth = oAppointment.$().outerWidth(),
								oGrid = oDropTarget.$().closest(".sapMSinglePCBlockersColumns").get(0).getBoundingClientRect(),
								oDropDim = oDropTarget.getDomRef().getBoundingClientRect(),
								iSubtractFromWidth = (oDropDim.left + iAppWidth) - (oGrid.left + oGrid.width);

							if (bIsFullDay) {
								$Indicator.css("min-height", iAppHeight);
								$Indicator.css("min-width", Math.min(iAppWidth, iAppWidth - iSubtractFromWidth));
							} else {
								$Indicator.css("min-height", oDragSession.getDropControl().$().outerHeight());
								$Indicator.css("min-width", oDragSession.getDropControl().$().outerWidth());
							}
						};

					if (!oDragSession.getIndicator()) {
						setTimeout(fnAlignIndicator, 0);
					} else {
						fnAlignIndicator();
					}
				}.bind(this),

				drop: function (oEvent) {
					var oDragSession = oEvent.getParameter("dragSession"),
						oAppointment = oDragSession.getDragControl(),
						oPlaceholder = oDragSession.getDropControl(),
						oStartDate = oPlaceholder.getDate().getJSDate(),
						oEndDate,
						oBrowserEvent = oEvent.getParameter("browserEvent"),
						bCopy = (oBrowserEvent.metaKey || oBrowserEvent.ctrlKey),
						bIsFullDay = this.isAllDayAppointment(oAppointment.getStartDate(), oAppointment.getEndDate());

					oEndDate = new Date(oStartDate);

					if (bIsFullDay) {
						oEndDate.setMilliseconds(oAppointment.getEndDate().getTime() - oAppointment.getStartDate().getTime());
					}

					this.$().find(".sapMSinglePCOverlay").removeClass("sapMSinglePCOverlayDragging");

					if (bIsFullDay && oAppointment.getStartDate().getTime() === oStartDate.getTime()) {
						return;
					}

					this.fireAppointmentDrop({
						appointment: oAppointment,
						startDate: oStartDate,
						endDate: oEndDate,
						copy: bCopy
					});
				}.bind(this)
			}));
		};

		SinglePlanningCalendarGrid.prototype._configureAppointmentsDragAndDrop = function () {
			this.addDragDropConfig(new DragDropInfo({
				sourceAggregation: "appointments",
				targetAggregation: "_intervalPlaceholders",

				dragStart: function (oEvent) {
					if (!this.getEnableAppointmentsDragAndDrop() || this._isResizingPerformed()) {
						oEvent.preventDefault();
						return false;
					}
					var fnHandleAppsOverlay = function () {
						var $Overlay = jQuery(".sapMSinglePCOverlay");

						setTimeout(function () {
							$Overlay.addClass("sapMSinglePCOverlayDragging");
						});

						jQuery(document).one("dragend", function () {
							$Overlay.removeClass("sapMSinglePCOverlayDragging");
						});
					};

					fnHandleAppsOverlay();
				}.bind(this),

				dragEnter: function (oEvent) {
					var oDragSession = oEvent.getParameter("dragSession"),
						oAppointment = oDragSession.getDragControl(),
						oDropTarget = oDragSession.getDropControl(),
						bIsFullDay = this.isAllDayAppointment(oAppointment.getStartDate(), oAppointment.getEndDate()),
						fnAlignIndicator = function () {
							var $Indicator = jQuery(oDragSession.getIndicator()),
								iAppHeight = oAppointment.$().outerHeight(),
								oGrid = oDropTarget.$().closest(".sapMSinglePCColumn").get(0).getBoundingClientRect(),
								oDropDim = oDragSession.getDropControl().getDomRef().getBoundingClientRect(),
								iSubtractFromHeight = (oDropDim.top + iAppHeight) - (oGrid.top + oGrid.height);

							if (bIsFullDay) {
								$Indicator.css("min-height", 2 * oDragSession.getDropControl().$().outerHeight());
							} else {
								$Indicator.css("min-height", Math.min(iAppHeight, iAppHeight - iSubtractFromHeight));
							}
						};

					if (!oDragSession.getIndicator()) {
						setTimeout(fnAlignIndicator, 0);
					} else {
						fnAlignIndicator();
					}
				}.bind(this),

				drop: function (oEvent) {
					var oDragSession = oEvent.getParameter("dragSession"),
						oAppointment = oDragSession.getDragControl(),
						oPlaceholder = oDragSession.getDropControl(),
						oStartDate = oPlaceholder.getDate().getJSDate(),
						oEndDate,
						oBrowserEvent = oEvent.getParameter("browserEvent"),
						bCopy = (oBrowserEvent.metaKey || oBrowserEvent.ctrlKey),
						bIsFullDay = this.isAllDayAppointment(oAppointment.getStartDate(), oAppointment.getEndDate());

					oEndDate = new Date(oStartDate);

					if (bIsFullDay) {
						oEndDate.setHours(oEndDate.getHours() + 1);
					} else {
						oEndDate.setMilliseconds(oAppointment.getEndDate().getTime() - oAppointment.getStartDate().getTime());
					}

					this.$().find(".sapMSinglePCOverlay").removeClass("sapMSinglePCOverlayDragging");

					if (!bIsFullDay && oAppointment.getStartDate().getTime() === oStartDate.getTime()) {
						return;
					}

					this.fireAppointmentDrop({
						appointment: oAppointment,
						startDate: oStartDate,
						endDate: oEndDate,
						copy: bCopy
					});
				}.bind(this)
			}));
		};

		SinglePlanningCalendarGrid.prototype._configureAppointmentsResize = function() {
			var oResizeConfig = new DragDropInfo({
				sourceAggregation: "appointments",
				targetAggregation: "_intervalPlaceholders",

				/**
				 * Fired when the user starts dragging an appointment.
				 */
				dragStart: function(oEvent) {
					if (!this.getEnableAppointmentsResize() || !this._isResizingPerformed()) {
						oEvent.preventDefault();
						return;
					}

					var oDragSession = oEvent.getParameter("dragSession"),
						$SPCGridOverlay = this.$().find(".sapMSinglePCOverlay"),
						$Indicator = jQuery(oDragSession.getIndicator()),
						$DraggedControl = oDragSession.getDragControl().$();

					if (this._isResizeHandleBottomMouseDownTarget) {
						oDragSession.setData("bottomHandle", "true");
					}

					if (this._isResizeHandleTopMouseDownTarget) {
						oDragSession.setData("topHandle", "true");
					}

					$Indicator.addClass("sapUiDnDIndicatorHide");
					setTimeout(function() {
						$SPCGridOverlay.addClass("sapMSinglePCOverlayDragging");
					}, 0);

					jQuery(document).one("dragend", function() {
						var oAppointmentStartingBoundaries = oDragSession.getComplexData("appointmentStartingBoundaries");

						$SPCGridOverlay.removeClass("sapMSinglePCOverlayDragging");
						$Indicator.removeClass("sapUiDnDIndicatorHide");

						$DraggedControl.css({
							top: oAppointmentStartingBoundaries.top,
							height: oAppointmentStartingBoundaries.height,
							"z-index": "auto",
							opacity: 1
						});
					});

					if (!Device.browser.msie && !Device.browser.edge) {
						oEvent.getParameter("browserEvent").dataTransfer.setDragImage(getResizeGhost(), 0, 0);
					}
				}.bind(this),

				/**
				 * Fired when a dragged appointment enters a drop target.
				 */
				dragEnter: function(oEvent) {
					var oDragSession = oEvent.getParameter("dragSession"),
						oAppointmentRef = oDragSession.getDragControl().$().get(0),
						oDropTarget = oDragSession.getDropControl().getDomRef(),
						oAppointmentStartingBoundaries = oDragSession.getComplexData("appointmentStartingBoundaries"),
						fnHideIndicator = function() {
							var $Indicator = jQuery(oDragSession.getIndicator());
							$Indicator.addClass("sapUiDnDIndicatorHide");
						},
						iTop,
						iBottom,
						iHeight,
						iVariableBoundaryY,
						mDraggedControlConfig;

					if (!oAppointmentStartingBoundaries) {
						oAppointmentStartingBoundaries = {
							top: oAppointmentRef.offsetTop,
							bottom: oAppointmentRef.offsetTop + oAppointmentRef.getBoundingClientRect().height,
							height: oAppointmentRef.getBoundingClientRect().height
						};
						oDragSession.setComplexData("appointmentStartingBoundaries", oAppointmentStartingBoundaries);
					}

					iVariableBoundaryY = oDragSession.getData("bottomHandle") ? oAppointmentStartingBoundaries.top : oAppointmentStartingBoundaries.bottom;

					iTop = Math.min(iVariableBoundaryY, oDropTarget.offsetTop);
					iBottom = Math.max(iVariableBoundaryY, oDropTarget.offsetTop + oDropTarget.getBoundingClientRect().height);
					iHeight = iBottom - iTop;

					mDraggedControlConfig = {
						top: iTop,
						height: iHeight,
						"z-index": 1,
						opacity: 0.8
					};

					oDragSession.getDragControl().$().css(mDraggedControlConfig);

					if (!oDragSession.getIndicator()) {
						setTimeout(fnHideIndicator, 0);
					} else {
						fnHideIndicator();
					}
				},

				/**
				 * Fired when an appointment is dropped.
				 */
				drop: function(oEvent) {
					var oDragSession = oEvent.getParameter("dragSession"),
						oAppointment = oDragSession.getDragControl(),
						iIndex = this.indexOfAggregation("_intervalPlaceholders", oDragSession.getDropControl()),
						oAppointmentStartingBoundaries = oDragSession.getComplexData("appointmentStartingBoundaries"),
						newPos;

					newPos = this._calcResizeNewHoursAppPos(
						oAppointment.getStartDate(),
						oAppointment.getEndDate(),
						iIndex,
						oDragSession.getData("bottomHandle")
					);

					this.$().find(".sapMSinglePCOverlay").removeClass("sapMSinglePCOverlayDragging");
					jQuery(oDragSession.getIndicator()).removeClass("sapUiDnDIndicatorHide");

					oAppointment.$().css({
						top: oAppointmentStartingBoundaries.top,
						height: oAppointmentStartingBoundaries.height,
						"z-index": "auto",
						opacity: 1
					});

					if (oAppointment.getEndDate().getTime() === newPos.endDate.getTime() &&
							oAppointment.getStartDate().getTime() === newPos.startDate.getTime()) {
						return;
					}

					this.fireAppointmentResize({
						appointment: oAppointment,
						startDate: newPos.startDate,
						endDate: newPos.endDate
					});
				}.bind(this)
			});

			oResizeConfig.setProperty("groupName", RESIZE_CONFIG_NAME);

			this.addDragDropConfig(oResizeConfig);
		};

		SinglePlanningCalendarGrid.prototype._calcResizeNewHoursAppPos = function(oAppStartDate, oAppEndDate, iIndex, bBottomHandle) {
			var oSPCStartDate = new Date(this.getStartDate().getFullYear(), this.getStartDate().getMonth(), this.getStartDate().getDate()),
				iMinutesStep = 30 * 60 * 1000, // 30 min
				iPlaceholderStartTime = oSPCStartDate.getTime() + iIndex * iMinutesStep,
				iPlaceholderEndTime = iPlaceholderStartTime + iMinutesStep,
				iVariableBoundaryTime = bBottomHandle ? oAppStartDate.getTime() : oAppEndDate.getTime(),
				iStartTime = Math.min(iVariableBoundaryTime, iPlaceholderStartTime),
				iEndTime = Math.max(iVariableBoundaryTime, iPlaceholderEndTime);

			return {
				startDate: new Date(iStartTime),
				endDate: new Date(iEndTime)
			};
		};

		SinglePlanningCalendarGrid.prototype._adjustAppointmentsHeightforCompact = function (sDate, oColumnStartDateAndHour, oColumnEndDateAndHour) {
			var oAppointment,
				$appointment,
				oAppStartDate,
				oAppEndDate,
				iAppTop,
				iAppBottom,
				bAppStartIsOutsideVisibleStartHour,
				bAppEndIsOutsideVisibleEndHour,
				iRowHeight = this._getRowHeight(),
				that = this;

			if (this._oAppointmentsToRender[sDate]) {
				this._oAppointmentsToRender[sDate].oAppointmentsList.getIterator().forEach(function(oAppNode) {
					oAppointment = oAppNode.getData();
					$appointment = jQuery("div[data-sap-day='" + sDate + "'].sapMSinglePCColumn #" + oAppointment.getId());
					oAppStartDate = oAppointment.getStartDate();
					oAppEndDate = oAppointment.getEndDate();
					bAppStartIsOutsideVisibleStartHour = oColumnStartDateAndHour.getTime() > oAppStartDate.getTime();
					bAppEndIsOutsideVisibleEndHour = oColumnEndDateAndHour.getTime() < oAppEndDate.getTime();

					iAppTop = bAppStartIsOutsideVisibleStartHour ? 0 : that._calculateTopPosition(oAppStartDate);
					iAppBottom = bAppEndIsOutsideVisibleEndHour ? 0 : that._calculateBottomPosition(oAppEndDate);

					$appointment.css("top", iAppTop);
					$appointment.css("bottom", iAppBottom);
					$appointment.find(".sapUiCalendarApp")
								.css("min-height", iRowHeight / 2 - 1);
				});
			}
		};

		SinglePlanningCalendarGrid.prototype._adjustBlockersHeightforCompact = function () {
			var iMaxLevel = this._getBlockersToRender().iMaxlevel,
				iContainerHeight = (iMaxLevel + 1) * this._getBlockerRowHeight(),
				iBlockerRowHeight = this._getBlockerRowHeight();

			if (iMaxLevel > 0) { // hackie thing to calculate the container witdth. When we have more than 1 line of blockers - we must add 3 px in order to render the blockers visually in the container.
				iContainerHeight = iContainerHeight + 3;
			}
			this.$().find(".sapMSinglePCBlockersColumns").css("height", iContainerHeight);

			this._oBlockersToRender.oBlockersList.getIterator().forEach(function(oBlokcerNode) {
				oBlokcerNode.getData().$().css("top", iBlockerRowHeight * oBlokcerNode.level + 1);
			});
		};

		SinglePlanningCalendarGrid.prototype.onAfterRendering = function () {
			var iColumns = this._getColumns(),
				oStartDate = this.getStartDate(),
				iRowHeight = this._getRowHeight();

			if (iRowHeight === ROW_HEIGHT_COMPACT) {
				for (var i = 0; i < iColumns; i++) {
					var oColumnCalDate = new CalendarDate(oStartDate.getFullYear(), oStartDate.getMonth(), oStartDate.getDate() + i),
						sDate = this._formatDayAsString(oColumnCalDate),
						oColumnStartDateAndHour = new UniversalDate(oColumnCalDate.getYear(), oColumnCalDate.getMonth(), oColumnCalDate.getDate(), this._getVisibleStartHour()),
						oColumnEndDateAndHour = new UniversalDate(oColumnCalDate.getYear(), oColumnCalDate.getMonth(), oColumnCalDate.getDate(), this._getVisibleEndHour(), 59, 59);
					this._adjustAppointmentsHeightforCompact(sDate, oColumnStartDateAndHour, oColumnEndDateAndHour);
				}
				this._adjustBlockersHeightforCompact();
			}
		};

		/**
		 * Handles the <code>keydown</code> event when any key is pressed.
		 *
		 * @param {jQuery.Event} oEvent The event object.
		 */
		SinglePlanningCalendarGrid.prototype.onkeydown = function (oEvent) {
			var oAppointment;

			if (oEvent.which === KeyCodes.SPACE || oEvent.which === KeyCodes.ENTER) {
				oAppointment = sap.ui.getCore().byId(oEvent.target.id);

				if (oAppointment && oAppointment.isA("sap.ui.unified.CalendarAppointment")) {
					this._toggleAppointmentSelection(oAppointment, !(oEvent.ctrlKey || oEvent.metaKey));
					this.fireAppointmentSelect({
						appointment: oAppointment
					});
				}

				// Prevent scrolling
				oEvent.preventDefault();
			}
		};

		SinglePlanningCalendarGrid.prototype.setStartDate = function (oStartDate) {
			this._oOldStartDate = this.getStartDate();
			this.getAggregation("_columnHeaders").setStartDate(oStartDate);

			return this.setProperty("startDate", oStartDate);
		};

		/**
		 * Holds the selected appointments. If no appointments are selected, an empty array is returned.
		 *
		 * @returns {sap.ui.unified.CalendarAppointment[]} All selected appointments
		 * @since 1.62
		 * @public
		 */
		SinglePlanningCalendarGrid.prototype.getSelectedAppointments = function() {
			return this.getAppointments().filter(function(oAppointment) {
				return oAppointment.getSelected();
			});
		};


		/*
		 * PRIVATE API
		 */

		/**
		 * Selects or deselects an appointment that is passed as a parameter. If it is selected, it is going to be
		 * deselected and vice versa. If modifier keys are pressed - the previously selected appointments will be
		 * preserved.
		 *
		 * @param {sap.m.CalendarAppointment} oAppointment The appointment to be selected/deselected.
		 * @param {boolean} [bRemoveOldSelection=false] If true, previously selected appointments will be deselected.
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._toggleAppointmentSelection = function (oAppointment, bRemoveOldSelection) {
			var aAppointments, i, iAppointmentsLength;

			if (bRemoveOldSelection) {
				aAppointments = this.getAppointments();
				for (i = 0, iAppointmentsLength = aAppointments.length; i < iAppointmentsLength; i++) {
					if (aAppointments[i].getId() !== oAppointment.getId() && aAppointments[i].getSelected()) {
						aAppointments[i].setProperty("selected", false, true); // do not invalidate
						// get appointment element(s) (it might be rendered in several columns) and remove its selection class
						jQuery('[data-sap-ui=' + aAppointments[i].getId() + ']').find(".sapUiCalendarApp").removeClass("sapUiCalendarAppSel");
					}
				}
			}

			oAppointment.setProperty("selected", !oAppointment.getSelected(), true); // do not invalidate
			// get appointment element(s) and toggle its selection class
			jQuery('[data-sap-ui=' + oAppointment.getId() + ']').find(".sapUiCalendarApp").toggleClass("sapUiCalendarAppSel", oAppointment.getSelected());
		};

		/**
		 * Handles the <code>tap</code> event on the grid.
		 *
		 * @param {jQuery.Event} oEvent The event object
		 */
		SinglePlanningCalendarGrid.prototype.ontap = function (oEvent) {
			var oAppointment = sap.ui.getCore().byId(oEvent.target.parentElement.id);

			if (oAppointment && oAppointment.isA("sap.ui.unified.CalendarAppointment")) {
				this._toggleAppointmentSelection(oAppointment, !(oEvent.ctrlKey || oEvent.metaKey));
				this.fireAppointmentSelect({
					appointment: oAppointment
				});
			}
		};

		/**
		 * Determines which is the first visible hour of the grid.
		 *
		 * @returns {int} the first visible hour of the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getVisibleStartHour = function () {
			// inject here the logic about the visibility of the fisrt visible hour, when the startHour property exist
			// example:
			// return this.getShowFullDay() ? 0 : this._getStartHour();
			return 0;
		};

		/**
		 * Determines which is the last visible hour of the grid.
		 *
		 * @returns {int} the last visible hour of the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getVisibleEndHour = function () {
			// inject here the logic about the visibility of the last visible hour, when the endHour property exist
			// example:
			// return (this.getShowFullDay() ? 24 : this._getEndHour()) - 1;
			return 23;
		};

		/**
		 * Determines if a given hour is between the first and the last visible hour in the grid.
		 *
		 * @returns {boolean} true if the iHour is in the visible hour range
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._isVisibleHour = function () {
			// inject here the logic about the visibility of the working time range, when the startHour and endHour
			// properties exist
			// example:
			// return this._getStartHour() <= iHour && iHour <= this._getEndHour();
			return true;
		};

		/**
		 * Determines whether the given hour is outside the visible hours of the grid.
		 *
		 * @returns {boolean} true if the iHour is outside the visible hour range
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._isOutsideVisibleHours = function () {
			// inject here the logic about the visibility of the working time range, when the startHour and endHour
			// properties exist
			// example:
			// var iVisibleStartHour = this._getVisibleStartHour(),
			// 	   iVisibleEndHour = this._getVisibleEndHour();
			// 	   return iHour < iVisibleStartHour || iHour > iVisibleEndHour;

			return false;
		};

		/**
		 * Determines whether the row header should be hidden based on the visible hours in the grid.
		 *
		 * @param {int} iRow the row to be checked
		 * @returns {boolean} true if the row should be hidden
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._shouldHideRowHeader = function (iRow) {
			var iCurrentHour = new Date().getHours(),
				bIsNearAfterCurrentHour = CalendarUtils._areCurrentMinutesLessThan(15) && iCurrentHour === iRow,
				bIsNearBeforeCurrentHour = CalendarUtils._areCurrentMinutesMoreThan(45) && iCurrentHour === iRow - 1;

			return bIsNearAfterCurrentHour || bIsNearBeforeCurrentHour;
		};

		/**
		 * Formats a given date to a string. Example: 2 Jun 2018 -> "20180502"
		 *
		 * @param {CalendarDate} oCalDate the date to be formatted
		 * @returns {string} the formatted string
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._formatDayAsString = function (oCalDate) {
			var sResult = "" + oCalDate.getYear(),
				sMonth =  oCalDate.getMonth(),
				sDate =  oCalDate.getDate();

			if (sMonth < 10) {
				sResult += "0";
			}
			sResult += sMonth;

			if (sDate < 10) {
				sResult += "0";
			}
			sResult += sDate;

			return sResult;
		};

		/**
		 * Formats the hour and minutes of the given date to a string. Example: 2 June 2018 17:54:33 -> "5:54"
		 *
		 * @param {object} oDate the date to be formatted
		 * @returns {string} the formatted string
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._formatTimeAsString = function (oDate) {
			var sPattern = this._getHoursPattern() + ":mm",
				oFormat = DateFormat.getDateTimeInstance({pattern: sPattern }, new Locale(this._getCoreLocaleId()));

			return oFormat.format(oDate);
		};

		/**
		 * Constructs a sting AM/PM part of a date. Example: 2 June 2018 17:54:33 -> " PM"
		 *
		 * @param {object} oDate the date to be formatted
		 * @returns {string} the formatted string
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._addAMPM = function (oDate) {
			var oAMPMFormat = this._getAMPMFormat();

			return " " + oAMPMFormat.format(oDate);
		};

		/**
		 * Calculates the top position of the now marker of an appointment - a regular one or an all-day one.
		 *
		 * @param {object} oDate the date of the element to be displayed
		 * @returns {int} the top position of the html element
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateTopPosition = function (oDate) {
			var iHour = oDate.getHours() - this._getVisibleStartHour(),
				iMinutes = oDate.getMinutes(),
				iRowHeight = this._getRowHeight();

			return (iRowHeight * iHour) + (iRowHeight / 60) * iMinutes;
		};

		/**
		 * Calculates the bottom position of an appointment.
		 *
		 * @param {object} oDate the date of the appointment to be displayed
		 * @returns {int} the bottom position of the html element
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateBottomPosition = function (oDate) {
			var iHour = this._getVisibleEndHour() + 1 - oDate.getHours(),
				iMinutes = oDate.getMinutes(),
				iRowHeight = this._getRowHeight();

			return (iRowHeight * iHour) - (iRowHeight / 60) * iMinutes;
		};

		/**
		 * Updates the now marker and the row headers positions in every minute.
		 *
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._updateRowHeaderAndNowMarker = function () {
			var oCurrentDate = new Date();

			this._updateNowMarker(oCurrentDate);
			this._updateRowHeaders(oCurrentDate);

			setTimeout(this._updateRowHeaderAndNowMarker.bind(this), ONE_MIN_MS);
		};

		/**
		 * Updates the now marker assuming that there is a DOM representation.
		 *
		 * @param {object} oDate the date to be displayed
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._updateNowMarker = function (oDate) {
			var $nowMarker = this.$("nowMarker"),
				$nowMarkerText = this.$("nowMarkerText"),
				$nowMarkerAMPM = this.$("nowMarkerAMPM"),
				bCurrentHourNotVisible = this._isOutsideVisibleHours(oDate.getHours());

			$nowMarker.toggleClass("sapMSinglePCNowMarkerHidden", bCurrentHourNotVisible);
			$nowMarker.css("top", this._calculateTopPosition(oDate) + "px");
			$nowMarkerText.text(this._formatTimeAsString(oDate));
			$nowMarkerAMPM.text(this._addAMPM(oDate));
			$nowMarkerText.append($nowMarkerAMPM);
		};

		/**
		 * Updates the row headers assuming that there is a DOM representation.
		 *
		 * @param {object} oDate the date to be displayed
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._updateRowHeaders = function (oDate) {
			var $domRef = this.$(),
				iCurrentHour = oDate.getHours(),
				iNextHour = iCurrentHour + 1;

			$domRef.find(".sapMSinglePCRowHeader").removeClass("sapMSinglePCRowHeaderHidden");

			if (this._shouldHideRowHeader(iCurrentHour)) {
				$domRef.find(".sapMSinglePCRowHeader" + iCurrentHour).addClass("sapMSinglePCRowHeaderHidden");
			} else if (this._shouldHideRowHeader(iNextHour)) {
				$domRef.find(".sapMSinglePCRowHeader" + iNextHour).addClass("sapMSinglePCRowHeaderHidden");
			}
		};

		/**
		 * Distributes the appointments and the all-day appointments in clusters by their date grid.
		 *
		 * @param {Array} aAppointments the appointments in the corresponding aggregation
		 * @returns {object} the clustered appointments - regular and all-day
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._createAppointmentsMap = function (aAppointments) {
			var that = this;

			return aAppointments.reduce(function (oMap, oAppointment) {
				var oAppStartDate = oAppointment.getStartDate(),
					oAppEndDate = oAppointment.getEndDate(),
					oCurrentAppCalStartDate,
					oCurrentAppCalEndDate,
					sDay;

				if (!oAppStartDate || !oAppEndDate) {
					return oMap;
				}

				if (!that.isAllDayAppointment(oAppStartDate, oAppEndDate)) {
					oCurrentAppCalStartDate = CalendarDate.fromLocalJSDate(oAppStartDate);
					oCurrentAppCalEndDate = CalendarDate.fromLocalJSDate(oAppEndDate);

					while (oCurrentAppCalStartDate.isSameOrBefore(oCurrentAppCalEndDate)) {
						sDay = that._formatDayAsString(oCurrentAppCalStartDate);

						if (!oMap.appointments[sDay]) {
							oMap.appointments[sDay] = [];
						}

						oMap.appointments[sDay].push(oAppointment);

						oCurrentAppCalStartDate.setDate(oCurrentAppCalStartDate.getDate() + 1);
					}
				} else {
					oMap.blockers.push(oAppointment);
				}

				return oMap;
			}, { appointments: {}, blockers: []});
		};

		/**
		 * Selects the clusters of appointments which are in the visual port of the grid.
		 *
		 * @param {object} oAppointments the appointments in the corresponding aggregation
		 * @param {Date} oStartDate the start date of the grid
		 * @param {int} iColumns the number of columns to be displayed in the grid
		 * @returns {object} the clusters of appointments in the visual port of the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateVisibleAppointments = function (oAppointments, oStartDate, iColumns) {
			var oVisibleAppointments = {},
				oCalDate,
				sDate,
				fnIsVisiblePredicate;

			for (var i = 0; i < iColumns; i++) {
				oCalDate = new CalendarDate(oStartDate.getFullYear(), oStartDate.getMonth(), oStartDate.getDate() + i);
				sDate = this._formatDayAsString(oCalDate);
				fnIsVisiblePredicate = this._isAppointmentFitInVisibleHours(oCalDate);

				if (oAppointments[sDate]) {
					oVisibleAppointments[sDate] = oAppointments[sDate]
						.filter(fnIsVisiblePredicate, this)
						.sort(this._sortAppointmentsByStartHourCallBack);
				}
			}

			return oVisibleAppointments;
		};

		/**
		 * Determines if an appointment fits in the visible hours of the grid.
		 *
		 * @param {CalendarDate} oColumnCalDate the start date of the grid
		 * @returns {boolean} true if the appointment is in the visible hours
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._isAppointmentFitInVisibleHours = function (oColumnCalDate) {
			return function (oAppointment) {
				var iAppStartTime = oAppointment.getStartDate().getTime(),
					iAppEndTime = oAppointment.getEndDate().getTime(),
					iColumnStartTime = (new UniversalDate(oColumnCalDate.getYear(), oColumnCalDate.getMonth(), oColumnCalDate.getDate(), this._getVisibleStartHour())).getTime(),
					iColumnEndTime = (new UniversalDate(oColumnCalDate.getYear(), oColumnCalDate.getMonth(), oColumnCalDate.getDate(), this._getVisibleEndHour(), 59, 59)).getTime();

				var bBiggerThanVisibleHours = iAppStartTime < iColumnStartTime && iAppEndTime > iColumnEndTime,
					bStartHourBetweenColumnStartAndEnd = iAppStartTime >= iColumnStartTime && iAppStartTime < iColumnEndTime,
					bEndHourBetweenColumnStartAndEnd = iAppEndTime > iColumnStartTime && iAppEndTime <= iColumnEndTime;

				return bBiggerThanVisibleHours || bStartHourBetweenColumnStartAndEnd || bEndHourBetweenColumnStartAndEnd;
			};
		};

		/**
		 * Calculates the position of each appointment regarding the rest of them.
		 *
		 * @param {object} oVisibleAppointments the visible appointments in the grid
		 * @returns {object} the visible appointments in the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateAppointmentsLevelsAndWidth = function (oVisibleAppointments) {
			var that = this;

			return Object.keys(oVisibleAppointments).reduce(function (oAcc, sDate) {
				var iMaxLevel = 0,
					oAppointmentsList = new SinglePlanningCalendarUtilities.list(),
					aAppointments = oVisibleAppointments[sDate];

				aAppointments.forEach(function (oCurrentAppointment) {
					var oCurrentAppointmentNode = new SinglePlanningCalendarUtilities.node(oCurrentAppointment),
						iCurrentAppointmentStart = oCurrentAppointment.getStartDate().getTime();

					if (oAppointmentsList.getSize() === 0) {
						oAppointmentsList.add(oCurrentAppointmentNode);
						return;
					}

					oAppointmentsList.getIterator().forEach(function (oAppointmentNode) {
						var bShouldBreak = true,
							oAppointment = oAppointmentNode.getData(),
							iAppointmentStart = oAppointment.getStartDate().getTime(),
							iAppointmentEnd = oAppointment.getEndDate().getTime(),
							iAppointmentDuration = iAppointmentEnd - iAppointmentStart;

						if (iAppointmentDuration < HALF_HOUR_MS) {
							// Take into account that appointments smaller than one hour will be rendered as one hour
							// in height. That's why the calculation for levels should consider this too.
							iAppointmentEnd = iAppointmentEnd + (HALF_HOUR_MS - iAppointmentDuration);
						}

						if (iCurrentAppointmentStart >= iAppointmentStart && iCurrentAppointmentStart < iAppointmentEnd) {
							oCurrentAppointmentNode.level++;
							iMaxLevel = Math.max(iMaxLevel, oCurrentAppointmentNode.level);
						}

						if (oAppointmentNode.next && oAppointmentNode.next.level === oCurrentAppointmentNode.level) {
							bShouldBreak = false;
						}

						if (iCurrentAppointmentStart >= iAppointmentEnd && bShouldBreak) {
							this.interrupt();
						}
					});

					oAppointmentsList.insertAfterLevel(oCurrentAppointmentNode.level, oCurrentAppointmentNode);
				});

				oAcc[sDate] = { oAppointmentsList: that._calculateAppointmentsWidth(oAppointmentsList), iMaxLevel: iMaxLevel };

				return oAcc;
			}, {});
		};

		/**
		 * Calculates width of each appointment.
		 *
		 * @param {object} oAppointmentsList the visible appointments in the grid
		 * @returns {object} the visible appointments in the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateAppointmentsWidth = function (oAppointmentsList) {

			oAppointmentsList.getIterator().forEach(function (oCurrentAppointmentNode) {
				var oCurrentAppointment = oCurrentAppointmentNode.getData(),
					iLevelFoundSpace = oCurrentAppointmentNode.level,
					iCurrentAppointmentLevel = oCurrentAppointmentNode.level,
					iCurrentAppointmentStart = oCurrentAppointment.getStartDate().getTime(),
					iCurrentAppointmentEnd = oCurrentAppointment.getEndDate().getTime(),
					iCurrentAppointmentDuration = iCurrentAppointmentEnd - iCurrentAppointmentStart;

				if (iCurrentAppointmentDuration < HALF_HOUR_MS) {
					// Take into account that appointments smaller than one hour will be rendered as one hour
					// in height. That's why the calculation for levels should consider this too.
					iCurrentAppointmentEnd = iCurrentAppointmentEnd + (HALF_HOUR_MS - iCurrentAppointmentDuration);
				}

				new SinglePlanningCalendarUtilities.iterator(oAppointmentsList).forEach(function (oAppointmentNode) {
					var oAppointment = oAppointmentNode.getData(),
						iAppointmentLevel = oAppointmentNode.level,
						iAppointmentStart = oAppointment.getStartDate().getTime(),
						iAppointmentEnd = oAppointment.getEndDate().getTime(),
						iAppointmentDuration = iAppointmentEnd - iAppointmentStart;

					if (iAppointmentDuration < HALF_HOUR_MS) {
						// Take into account that appointments smaller than one hour will be rendered as one hour
						// in height. That's why the calculation for levels should consider this too.
						iAppointmentEnd = iAppointmentEnd + (HALF_HOUR_MS - iAppointmentDuration);
					}

					if (iCurrentAppointmentLevel >= iAppointmentLevel) {
						return;
					}

					if (
						iCurrentAppointmentStart >= iAppointmentStart && iCurrentAppointmentStart < iAppointmentEnd ||
						iCurrentAppointmentEnd > iAppointmentStart && iCurrentAppointmentEnd < iAppointmentEnd ||
						iCurrentAppointmentStart <= iAppointmentStart && iCurrentAppointmentEnd >= iAppointmentEnd
					) {
						oCurrentAppointmentNode.width = iAppointmentLevel - iCurrentAppointmentLevel;
						this.interrupt();
						return;
					}

					if (iLevelFoundSpace < iAppointmentLevel) {
						iLevelFoundSpace = iAppointmentLevel;
						oCurrentAppointmentNode.width++;
					}
				});
			});

			return oAppointmentsList;
		};

		/**
		 * Selects the clusters of all-day appointments which are in the visual port of the grid.
		 *
		 * @param {object} aBlockers the all-day appointments in the corresponding aggregation
		 * @param {CalendarDate} oCalStartDate the start date of the grid
		 * @param {int} iColumns the number of columns to be displayed in the grid
		 * @returns {object} the clusters of all-day appointments in the visual port of the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateVisibleBlockers = function (aBlockers, oCalStartDate, iColumns) {
			var oCalEndDate = new CalendarDate(oCalStartDate.getYear(), oCalStartDate.getMonth(), oCalStartDate.getDate() + iColumns),
				fnIsVisiblePredicate = this._isBlockerVisible(oCalStartDate, oCalEndDate);

			return aBlockers.filter(fnIsVisiblePredicate)
				.sort(this._sortAppointmentsByStartHourCallBack);
		};

		/**
		 * Determines whether the blocker is in the visible grid area.
		 *
		 * @param {CalendarDate} oViewStart The start date of the view
		 * @param {CalendarDate} oViewEnd The end date of the view
		 * @returns {boolean} true if the blocker is visible
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._isBlockerVisible = function (oViewStart, oViewEnd) {
			return function (oAppointment) {
				var oAppStart = CalendarDate.fromLocalJSDate(oAppointment.getStartDate()),
					oAppEnd = CalendarDate.fromLocalJSDate(oAppointment.getEndDate());

				var bIsBiggerThanView = oAppStart.isBefore(oViewStart) && oAppEnd.isAfter(oViewEnd),
					bStartDateBetweenViewStartAndEnd = oAppStart.isSameOrAfter(oViewStart) && oAppStart.isBefore(oViewEnd),
					bEndDateBetweenViewStartAndEnd = CalendarUtils._isBetween(oAppEnd, oViewStart, oViewEnd, true);

				return bIsBiggerThanView || bStartDateBetweenViewStartAndEnd || bEndDateBetweenViewStartAndEnd;
			};
		};

		/**
		 * Calculates the position of each all-day appointment regarding the rest of them.
		 *
		 * @param {object} aVisibleBlockers the visible all-day appointments in the grid
		 * @returns {object} the visible all-day appointments in the grid
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._calculateBlockersLevelsAndWidth = function (aVisibleBlockers) {
			var iMaxLevel = 0,
				oBlockersList = new SinglePlanningCalendarUtilities.list();

			aVisibleBlockers.forEach(function (oCurrentBlocker) {
				var oCurrentBlockerNode = new SinglePlanningCalendarUtilities.node(oCurrentBlocker),
					oCurrentBlockerStart = CalendarDate.fromLocalJSDate(oCurrentBlocker.getStartDate()),
					oCurrentBlockerEnd = CalendarDate.fromLocalJSDate(oCurrentBlocker.getEndDate());

				oCurrentBlockerNode.width = CalendarUtils._daysBetween(oCurrentBlockerEnd, oCurrentBlockerStart);

				if (oBlockersList.getSize() === 0) {
					oBlockersList.add(oCurrentBlockerNode);
					return;
				}

				oBlockersList.getIterator().forEach(function (oBlockerNode) {
					var bShouldBreak = true,
						oBlocker = oBlockerNode.getData(),
						oBlockerStart = CalendarDate.fromLocalJSDate(oBlocker.getStartDate()),
						oBlockerEnd = CalendarDate.fromLocalJSDate(oBlocker.getEndDate());

					if (oCurrentBlockerStart.isSameOrAfter(oBlockerStart) && oCurrentBlockerStart.isSameOrBefore(oBlockerEnd)) {
						oCurrentBlockerNode.level++;
						iMaxLevel = Math.max(iMaxLevel, oCurrentBlockerNode.level);
					}

					if (oBlockerNode.next && oBlockerNode.next.level === oCurrentBlockerNode.level) {
						bShouldBreak = false;
					}

					if (oCurrentBlockerStart.isSameOrAfter(oBlockerEnd) && bShouldBreak) {
						this.interrupt();
					}
				});

				oBlockersList.insertAfterLevel(oCurrentBlockerNode.level, oCurrentBlockerNode);
			}, this);

			return { oBlockersList: oBlockersList, iMaxlevel: iMaxLevel };
		};

		/**
		 * Calculates the time difference between the two given appointments.
		 *
		 * @param {object} oApp1 the first appointment to compare
		 * @param {object} oApp2 the other appointment to compare
		 * @returns {int} the time difference between the appointments
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._sortAppointmentsByStartHourCallBack = function (oApp1, oApp2) {
			return oApp1.getStartDate().getTime() - oApp2.getStartDate().getTime() || oApp2.getEndDate().getTime() - oApp1.getEndDate().getTime();
		};

		/**
		 * Returns the visible appointments in the view port of the grid.
		 *
		 * @returns {object} the visual appointments
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getVisibleAppointments = function () {
			return this._oVisibleAppointments;
		};

		/**
		 * Returns the visible appointments in the view port of the grid with their level and width.
		 *
		 * @returns {object} the visual appointments
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getAppointmentsToRender = function () {
			return this._oAppointmentsToRender;
		};

		/**
		 * Returns the visible all-day appointments in the view port of the grid.
		 *
		 * @returns {object} the visual all-day appointments
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getVisibleBlockers = function () {
			return this._aVisibleBlockers;
		};

		/**
		 * Returns the visible all-day appointments in the view port of the grid with their level and width.
		 *
		 * @returns {object} the visual all-day appointments
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getBlockersToRender = function () {
			return this._oBlockersToRender;
		};

		/**
		 * Sets how many columns to be displayed in the grid.
		 *
		 * @param {int} iColumns the number of columns to be displayed
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._setColumns = function (iColumns) {
			this._iOldColumns = this._iColumns;
			this._iColumns = iColumns;
			this.getAggregation("_columnHeaders").setDays(iColumns);

			this.invalidate();
			return this;
		};

		/**
		 * Returns how many columns will be displayed in the grid.
		 *
		 * @returns {int} the number of columns to be displayed
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getColumns = function () {
			return this._iColumns;
		};

		/**
		 * Returns the height of a row in the grid.
		 *
		 * @returns {int} the height of a row
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getRowHeight = function () {
			return this._isCompact() ? ROW_HEIGHT_COMPACT : ROW_HEIGHT_COZY;
		};

		/**
		 * Returns the height of an all-day appointment in the grid.
		 *
		 * @returns {int} the height of an all-day appointment
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getBlockerRowHeight = function () {
			return this._isCompact() ? BLOCKER_ROW_HEIGHT_COMPACT : BLOCKER_ROW_HEIGHT_COZY;
		};

		SinglePlanningCalendarGrid.prototype._isCompact = function () {
			var oDomRef = this.getDomRef();

			while (oDomRef && oDomRef.classList) {
				if (oDomRef.classList.contains("sapUiSizeCompact")) {
					return true;
				}
				oDomRef = oDomRef.parentNode;
			}

			return false;
		};

		/**
		 * Returns the format settings about the locale.
		 *
		 * @return {string} the format settings about the locale
		 */
		SinglePlanningCalendarGrid.prototype._getCoreLocaleId = function () {
			if (!this._sLocale) {
				this._sLocale = sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale().toString();
			}

			return this._sLocale;
		};

		/**
		 * Returns the locale data.
		 *
		 * @return {object} the locale object
		 */
		SinglePlanningCalendarGrid.prototype._getCoreLocaleData = function() {
			var sLocale,
				oLocale;

			if (!this._oLocaleData) {
				sLocale = this._getCoreLocaleId();
				oLocale = new Locale(sLocale);

				this._oLocaleData = LocaleData.getInstance(oLocale);
			}

			return this._oLocaleData;
		};

		/**
		 * Evaluates whether AM/PM is contained in the time format.
		 *
		 * @return {boolean} true if AM/PM is contained
		 */
		SinglePlanningCalendarGrid.prototype._hasAMPM = function () {
			var oLocaleData = this._getCoreLocaleData();

			return oLocaleData.getTimePattern("short").search("a") >= 0;
		};

		/**
		 * Returns the hours format.
		 *
		 * @return {object} the hours format
		 */
		SinglePlanningCalendarGrid.prototype._getHoursFormat = function () {
			var sLocale = this._getCoreLocaleId();

			if (!this._oHoursFormat || this._oHoursFormat.oLocale.toString() !== sLocale) {
				var oLocale = new Locale(sLocale),
					sPattern = this._getHoursPattern();
				this._oHoursFormat = DateFormat.getTimeInstance({pattern: sPattern}, oLocale);
			}

			return this._oHoursFormat;
		};

		/**
		 * Returns the hours pattern.
		 *
		 * @return {object} the hours pattern
		 */
		SinglePlanningCalendarGrid.prototype._getHoursPattern = function () {
			return this._hasAMPM() ? "h" : "H";
		};

		/**
		 * Returns the AM/PM format.
		 *
		 * @return {object} the AM/PM format
		 */
		SinglePlanningCalendarGrid.prototype._getAMPMFormat = function () {
			var sLocale = this._getCoreLocaleId(),
				oLocale = new Locale(sLocale);

			if (!this._oAMPMFormat || this._oAMPMFormat.oLocale.toString() !== sLocale) {
				this._oAMPMFormat = DateFormat.getTimeInstance({pattern: "a"}, oLocale);
			}

			return this._oAMPMFormat;
		};

		/**
		 * Getter for _columnHeaders.
		 *
		 * @returns {object} The _columnHeaders object
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getColumnHeaders = function () {
			return this.getAggregation("_columnHeaders");
		};

		/**
		 * Gets Start/End information for a given a appointment.
		 *
		 * @param {sap.ui.unified.CalendarAppointment} oAppointment - The appointment for which Start/End information will be generated.
		 * @returns {string}
		 * @private
		 */
		SinglePlanningCalendarGrid.prototype._getAppointmentStartEndInfo = function (oAppointment) {
			var sStartTime = this._oUnifiedRB.getText("CALENDAR_START_TIME"),
				sEndTime = this._oUnifiedRB.getText("CALENDAR_END_TIME"),
				sFormattedStartDate = this._oFormatAria.format(oAppointment.getStartDate()),
				sFormattedEndDate = this._oFormatAria.format(oAppointment.getEndDate());

			return sStartTime + ": " + sFormattedStartDate + "; " + sEndTime + ": " + sFormattedEndDate;
		};

		/**
		 * This method is a hook for the RenderManager that gets called
		 * during the rendering of child Controls. It allows to add,
		 * remove and update existing accessibility attributes (ARIA) of
		 * those controls.
		 *
		 * @param {sap.ui.core.Control} oControl - The Control that gets rendered by the RenderManager
		 * @param {Object} mAriaProps - The mapping of "aria-" prefixed attributes
		 * @protected
		 */
		SinglePlanningCalendarGrid.prototype.enhanceAccessibilityState = function(oControl, mAriaProps) {
			if (oControl.getId() === this._getColumnHeaders().getId()) {
				mAriaProps.labelledby = InvisibleText.getStaticId("sap.m", "PLANNINGCALENDAR_DAYS");
			}
		};

		/**
		 * Returns whether the appointment starts at 00:00 and ends in 00:00 on any day in the future.
		 *
		 * @param {Object} oAppStartDate - Start date of the appointment
		 * @param {Object} oAppEndDate - End date of the appointment
		 * @returns {boolean}
		 */
		SinglePlanningCalendarGrid.prototype.isAllDayAppointment = function(oAppStartDate, oAppEndDate) {
			var bStartDateHours = oAppStartDate.getHours() === 0,
				bStartDateMinutes = oAppStartDate.getMinutes() === 0,
				bStartDateSeconds = oAppStartDate.getSeconds() === 0,
				bStartDateMilliseconds = oAppStartDate.getMilliseconds() === 0,
				bStartTimeIs0000 = bStartDateHours && bStartDateMinutes && bStartDateSeconds && bStartDateMilliseconds,
				bAllDay = false;

			if (bStartTimeIs0000) {
				bAllDay = this._isEndTime0000(oAppStartDate, oAppEndDate);
			}

			return bAllDay;
		};

		/**
		 * When we're inside this method we know for sure that the start time is 00:00.
		 * It returns whether the end time is also 00:00.
		 *
		 * @param {Object} oAppStartDate - Start date of the appointment
		 * @param {Object} oAppEndDate - End date of the appointment
		 * @returns {boolean}
		 */
		SinglePlanningCalendarGrid.prototype._isEndTime0000 = function(oAppStartDate, oAppEndDate) {
			return (oAppEndDate.getTime() - oAppStartDate.getTime()) % MILLISECONDS_IN_A_DAY === 0;
		};

		SinglePlanningCalendarGrid.prototype._createBlockersDndPlaceholders = function (oStartDate, iColumns) {
			this.destroyAggregation("_blockersPlaceholders");

			for (var i = 0; i < iColumns; i++) {
				var oColumnCalDate = new UniversalDate(oStartDate.getFullYear(), oStartDate.getMonth(), oStartDate.getDate() + i);

				var oPlaceholder = new IntervalPlaceholder({
					date: oColumnCalDate
				});

				this.addAggregation("_blockersPlaceholders", oPlaceholder, true);
			}
		};

		SinglePlanningCalendarGrid.prototype._createAppointmentsDndPlaceholders = function (oStartDate, iColumns) {
			var iStartHour = this._getVisibleStartHour(),
				iEndHour = this._getVisibleEndHour();

			this._dndPlaceholdersMap = {};
			this.destroyAggregation("_intervalPlaceholders");

			for (var i = 0; i < iColumns; i++) {
				var oColumnCalDate = new CalendarDate(oStartDate.getFullYear(), oStartDate.getMonth(), oStartDate.getDate() + i);

				if (!this._dndPlaceholdersMap[oColumnCalDate]) {
					this._dndPlaceholdersMap[oColumnCalDate] = [];
				}

				for (var j = iStartHour; j <= iEndHour; j++) {
					var aDndForTheDay = this._dndPlaceholdersMap[oColumnCalDate],
						iYear = oColumnCalDate.getYear(),
						iMonth = oColumnCalDate.getMonth(),
						iDate = oColumnCalDate.getDate();
					aDndForTheDay.push(this._createAppointmentsDndPlaceHolder(new UniversalDate(iYear, iMonth, iDate, j)));
					aDndForTheDay.push(this._createAppointmentsDndPlaceHolder(new UniversalDate(iYear, iMonth, iDate, j, 30)));
				}
			}
		};

		SinglePlanningCalendarGrid.prototype._createAppointmentsDndPlaceHolder = function(oDate) {
			var oPlaceholder = new IntervalPlaceholder({
				date: oDate
			});

			this.addAggregation("_intervalPlaceholders", oPlaceholder, true);

			return oPlaceholder;
		};

		function getResizeGhost() {
			var $ghost = jQuery("<span></span>").addClass("sapUiCalAppResizeGhost");
			$ghost.appendTo(document.body);

			setTimeout(function() { $ghost.remove(); }, 0);

			return $ghost.get(0);
		}

		var IntervalPlaceholder = Control.extend("sap.m.SinglePlanningCalendarGrid._internal.IntervalPlaceholder", {
			metadata: {
				properties: {
					date : {type : "object", group : "Data"}
				}
			},
			renderer: function(oRm, oControl) {
				oRm.write("<div");
				oRm.writeControlData(oControl);
				oRm.addClass("sapMSinglePCPlaceholder");
				oRm.writeClasses();
				oRm.write("></div>");
			}
		});

		return SinglePlanningCalendarGrid;
	});
