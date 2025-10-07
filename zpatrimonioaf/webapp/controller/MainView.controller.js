sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageBox,
  ) {
    "use strict";

    return Controller.extend("zpatrimonioaf.controller.MainView", {
      onInit: function () {
        const oModel = new JSONModel();
        oModel.attachRequestCompleted(this.changeItemsCombobox.bind(this));
        const sUrl = sap.ui.require.toUrl("zpatrimonioaf/model/localModel.json");
        oModel.loadData(sUrl);
        this.getOwnerComponent().setModel(this.oModel, "Sociedades");
      },
      onBack: function () {
        // eslint-disable-next-line fiori-custom/sap-no-hardcoded-url, fiori-custom/sap-no-localhost, fiori-custom/sap-no-location-usage
        window.location.href = "http://localhost:8080/index.html";
      },
      //Funcion para no mostrar sociedades duplicadas en el combobox
      changeItemsCombobox: function () {
        let oModel = this.getView().getModel("Sociedades");
        let data = oModel.getData();
        let aSociedades = [];
        let seen = new Set();

        data.datos.forEach((item) => {
          if (!seen.has(item.Sociedad)) {
            seen.add(item.Sociedad);
            aSociedades.push(item);
          }
        });
        //Se crea el nuevo modelo de datos para el combo box con las sociedades sin duplicados
        let oModelCombobox = new JSONModel({ Sociedades: aSociedades });
        this.getView().setModel(oModelCombobox, "ModelCombobox");
      },
      onPress: function () {
        this.oMultiCombo = this.byId("combosociedad");
        this.aSelectedKeys = this.oMultiCombo.getSelectedKeys();
        // Validar si los campos están vacíos
        if (this.aSelectedKeys.length === 0) {
          MessageBox.error(
            "El campo 'Sociedad' es obligatorio. Por favor, seleccione al menos una."
          );
          return;
        }

        this.getView().setModel(this.oModel, "localModel");
        this.oTable = this.byId("table");
        this.oBinding = this.oTable.getBinding("rows");
        this.onApplyFilters();
      },

      onApplyFilters: function () {
        this.aFilters = [];
        this.onCombobox();
        this.onDateRange();
        // --- Aplicamos filtros a la tabla ---
        if (this.aFilters.length > 0) {
          this.oBinding.filter(
            new Filter({
              filters: this.aFilters,
              and: true, // sociedad AND (ctamayor1 OR ctamayor2...) AND Fechas
            })
          );
        } else {
          this.oBinding.filter([]);
        }
      },
      onCombobox: function () {
        const oMultiCombo = this.byId("combosociedad");
        const aSelectedKeys = oMultiCombo.getSelectedKeys(); // array de sociedades seleccionadas

        if (aSelectedKeys.length > 0) {
          // Creamos un filtro OR para todas las selecciones
          const aFiltersOr = aSelectedKeys.map(
            (sKey) => new Filter("Sociedad", FilterOperator.EQ, sKey)
          );
          const oFilter = new Filter({
            filters: aFiltersOr,
            and: false, // OR entre los filtros
          });
          this.aFilters.push(oFilter);
        } else {
          const sValue = oMultiCombo.getValue();
          if (sValue) {
            MessageBox.error("La sociedad ingresada no es válida");
            oMultiCombo.setValue("");
            return;
          }
        }
      },
      onDateRange: function () {
        this.oDateRange = this.byId("_IDGenDateRangeSelection");
        const oFirstDate = this.oDateRange.getDateValue();
        const oSecondDate = this.oDateRange.getSecondDateValue();

        const oFirstDate2 = this.formatDate(oFirstDate);
        const oSecondDate2 = this.formatDate(oSecondDate);

        if (oFirstDate2 && oSecondDate2) {
          this.aFilters.push(
            new Filter(
              "FechaInforme",
              FilterOperator.BT,
              oFirstDate2,
              oSecondDate2
            )
          );
        }
      },
      formatDate: function (date) {
        var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
          pattern: "yyyy-MM-dd",
        });
        return oDateFormat.format(date);
      },
      onClearDateRange: function () {
        this.oDateRange.setDateValue(null);
        this.oDateRange.setSecondDateValue(null);
      },
      //---------------EXPORTAR VALORES DE LA TABLA A EXCEL-----------
      onExportToExcel: function () {
        const oTable = this.byId("table");
        const oBinding = oTable.getBinding("rows");

        if (!oBinding) {
          return;
        }

        const aRowObjects = oBinding
          .getContexts(0, oBinding.getLength())
          .map((oContext) => oContext.getObject());

        if (!aRowObjects || aRowObjects.length === 0) {
          MessageBox.error("No hay datos para exportar.");
          return;
        }

        const aFinalData = [];
        const aHeaders = [];
        const aProperties = [];

        // 1. Lee las columnas visibles para obtener los encabezados y las propiedades
        oTable.getColumns().forEach((oColumn) => {
          if (oColumn.getVisible()) {
            aHeaders.push(oColumn.getLabel().getText());

            const oTemplate = oColumn.getTemplate();
            if (oTemplate) {
              const oBindingInfo = oTemplate.getBindingInfo("text");
              if (
                oBindingInfo &&
                oBindingInfo.parts &&
                oBindingInfo.parts.length > 0
              ) {
                aProperties.push(oBindingInfo.parts[0].path);
              } else {
                aProperties.push(null); // Columna sin datos
              }
            }
          }
        });

        // 2. Añade la fila de encabezados al array final
        aFinalData.push(aHeaders);

        // 3. Convierte cada objeto de datos en un array de valores, usando el orden de 'aProperties' para asegurar la correspondencia.
        aRowObjects.forEach((oItem) => {
          const aRow = [];
          aProperties.forEach((sProperty) => {
            if (sProperty) {
              aRow.push(oItem[sProperty]);
            } else {
              aRow.push(""); // Celda vacía para columnas sin binding
            }
          });
          aFinalData.push(aRow);
        });

        // --- FIN DE LA LÓGICA ---

        // 4. Crea la hoja de cálculo desde "array de arrays".
        const ws = XLSX.utils.aoa_to_sheet(aFinalData);

        // 5. Crea y desca el archivo.
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFileXLSX(wb, "Cuadro de activos fijos.xlsx");

        MessageBox.success("Exportación exitosa.");
      },
      onRowSelectionChange: function (oEvent) {
        const oTable = oEvent.getSource();
        const iSelectedIndex = oEvent.getParameter("rowIndex");
        const oContext = oTable.getContextByIndex(iSelectedIndex);
        const sSociedad = oContext.getProperty("Sociedad");
        const sActivoFijo = oContext.getProperty("ActivoFijo");
        const sEjercicio = oContext.getProperty("Ejercicio");

        // 1. Obtener la configuración del manifest.json
        const oManifest = this.getOwnerComponent().getManifest();
        // 2. Leer la URL guardada
        const sBaseUrl = oManifest["sap.app"].dataSources.aw01nApp.uri;
        // 3. Construir el arreglo con los parametros a enviar
        const oParams = {
          sociedad: sSociedad,
          activofijo: sActivoFijo,
          ejercicio: sEjercicio,
        };
        // 4. Construimos la URL y navegamos
        const sParamString = jQuery.param(oParams);
        const sTargetURL = `${sBaseUrl}#/?${sParamString}`;
        window.open(sTargetURL, "_blank");
      },
    });
  }
);
