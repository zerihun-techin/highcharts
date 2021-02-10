/* eslint-disable brace-style */
/* eslint-disable no-console */
/* eslint-disable valid-jsdoc */
/* *
 *
 *  Imports
 *
 * */
import CS from '../../Core/Series/Series.js';
import DataPoint from './DataPoint.js';
import DataTable from '../DataTable.js';
import LegendSymbolMixin from '../../Mixins/LegendSymbol.js';
import SeriesRegistry from '../../Core/Series/SeriesRegistry.js';
import U from '../../Core/Utilities.js';
var cleanRecursively = U.cleanRecursively, extend = U.extend, fireEvent = U.fireEvent, getOptions = U.getOptions, merge = U.merge, pick = U.pick;
/* *
 *
 *  Constants
 *
 * */
var DEBUG = !!getOptions().debug;
/* *
 *
 *  Class
 *
 * */
var DataSeries = /** @class */ (function () {
    /* *
     *
     *  Constructor
     *
     * */
    function DataSeries(chart, options) {
        if (options === void 0) { options = {}; }
        DEBUG && console.log('DataSeries.constructor');
        this.chart = chart;
        this.data = [];
        this.linkedSeries = [];
        this.options = this.setOptions(options);
        this.points = [];
        this.state = '';
        this.table = new DataTable();
        this.tableListeners = [];
        this.userOptions = options;
        this.visible = true;
        this.setData(options.data || []);
    }
    /* *
     *
     *  Functions
     *
     * */
    DataSeries.prototype.destroy = function () {
        DEBUG && console.log('DataSeries.destroy');
        this.destroyTableListeners();
    };
    DataSeries.prototype.destroyTableListeners = function () {
        DEBUG && console.log('DataSeries.destroyTableListeners');
        var series = this, tableListeners = series.tableListeners.slice();
        series.tableListeners.length = 0;
        for (var i = 0, iEnd = tableListeners.length; i < iEnd; ++i) {
            tableListeners[i]();
        }
    };
    /* public findPoint(
        tableRow: DataTableRow,
        startIndex: number = 0
    ): (this['pointClass']['prototype']|undefined) {
        if (tableRow.isNull()) {
            return;
        }

        const series = this,
            data = series.data,
            id = tableRow.id,
            x = tableRow.getCellAsNumber('x');

        let point: typeof series.data[0],
            pointTableRow: (DataTableRow);

        for (let i = startIndex, iEnd = data.length; i < iEnd; ++i) {
            point = data[i];
            if (point) {
                pointTableRow = point.tableRow;
                if (pointTableRow === tableRow) {
                    return point;
                }
                if (pointTableRow.id === id) {
                    return point;
                }
                if (pointTableRow.getCellAsNumber('x') === x) {
                    return point;
                }
            }
        }
    } */
    DataSeries.prototype.hasData = function () {
        DEBUG && console.log('DataSeries.hasData');
        return (this.table.getRowCount() > 0);
    };
    /** @deprecated */
    DataSeries.prototype.init = function (chart, options) {
        DEBUG && console.log('DataSeries.init');
        var series = this;
        fireEvent(series, 'init');
        series.chart = chart;
        series.setOptions(options);
        series.bindAxes();
        chart.series.push(series);
        series.setData(options.data || []);
        fireEvent(series, 'afterInit');
    };
    DataSeries.prototype.plotGroup = function (parent) {
        DEBUG && console.log('DataSeries.plotGroup');
        var series = this, chart = series.chart, options = series.options, zIndex = options.zIndex, attributes = {
            translateX: chart.plotLeft,
            translateY: chart.plotTop,
            scaleX: 1,
            scaleY: 1,
            visibility: series.visible,
            zIndex: zIndex
        };
        // Avoid setting undefined opacity, or in styled mode
        if (typeof this.opacity !== 'undefined' &&
            !this.chart.styledMode &&
            this.state !== 'inactive' // #13719
        ) {
            attributes.opacity = this.opacity;
        }
        return parent.renderer
            .g()
            .addClass('highcharts-data-series')
            .attr(attributes)
            .add(parent);
    };
    DataSeries.prototype.redraw = function () {
        DEBUG && console.log('DataSeries.redraw');
        var series = this;
        series.translate();
        series.render();
        if (series.isDirty ||
            series.isDirtyData) { // #3868, #3945
            delete series.kdTree;
        }
    };
    /**
     * Render series as points.
     */
    DataSeries.prototype.render = function (parent) {
        DEBUG && console.log('DataSeries.render');
        var series = this, chart = series.chart, points = series.points, renderer = chart.renderer;
        var group = series.group;
        if (parent) {
            group = series.plotGroup(parent);
        }
        else if (!group) {
            series.group = group = series.plotGroup(chart.seriesGroup || renderer.boxWrapper);
        }
        for (var i = 0, iEnd = points.length, point = void 0; i < iEnd; ++i) {
            point = points[i];
            if (point) {
                point.render(group);
            }
        }
    };
    /** @deprecated */
    DataSeries.prototype.setData = function (data) {
        DEBUG && console.log('DataSeries.setData');
        var series = this;
        if (series.table.getRowCount() > 0) {
            // @todo find point/rows to update
        }
        else {
            series.setTable(DataSeries.getTableFromSeriesOptions({
                data: data,
                keys: series.pointArrayMap
            }));
        }
    };
    /** @private */
    DataSeries.prototype.setOptions = function (options) {
        DEBUG && console.log('DataSeries.setOptions');
        var series = this, chart = series.chart;
        fireEvent(series, 'setOptions', { userOptions: options });
        series.options = merge(DataSeries.defaultOptions, (chart &&
            chart.options.plotOptions &&
            chart.options.plotOptions.series), (chart &&
            chart.userOptions &&
            chart.userOptions.plotOptions &&
            chart.userOptions.plotOptions[series.type]), options);
        series.userOptions = merge(options);
        fireEvent(series, 'afterSetOptions', { options: series.options });
        return series.options;
    };
    /**
     * Add or update table.
     */
    DataSeries.prototype.setTable = function (table) {
        DEBUG && console.log('DataSeries.setTable');
        var series = this, seriesData = series.data, seriesDataLength = seriesData.length, tableRows = table.getAllRows(), tableRowsLength = tableRows.length, SeriesPoint = series.pointClass;
        if (series.table === table) {
            return;
        }
        series.destroyTableListeners();
        series.table = table;
        for (var i = 0, iEnd = tableRowsLength, point = void 0, tableRow = void 0; i < iEnd; ++i) {
            point = seriesData[i];
            tableRow = tableRows[i];
            if (tableRow.isNull()) {
                if (point) {
                    point.destroy();
                }
                seriesData[i] = null;
            }
            else if (point &&
                point.tableRow !== tableRow) {
                point.setTableRow(tableRow);
            }
            else {
                seriesData[i] = new SeriesPoint(series, tableRow, i);
            }
        }
        if (seriesDataLength > tableRowsLength) {
            for (var i = tableRowsLength, iEnd = seriesDataLength, point = void 0; i < iEnd; ++i) {
                point = seriesData[i];
                if (point) {
                    point.destroy();
                }
            }
            seriesData.length = tableRowsLength;
        }
        series.tableListeners.push(table.on('afterInsertRow', function (e) {
            if (e.type === 'afterInsertRow') {
                var index = e.index, row = e.row;
                seriesData.splice(index, 0, new DataPoint(series, row, index));
            }
        }), table.on('afterDeleteRow', function (e) {
            if (e.type === 'afterUpdateRow') {
                var index = e.index;
                seriesData.splice(index, 1);
            }
        }));
        // series.tableListener =  ---> point listener?
    };
    DataSeries.prototype.translate = function () {
        DEBUG && console.log('DataSeries.translate');
        var series = this;
        series.points = series.data.slice();
    };
    DataSeries.prototype.update = function (options, redraw) {
        DEBUG && console.log('DataSeries.update');
        var series = this;
        options = cleanRecursively(options, series.options);
        fireEvent(series, 'update', { options: options });
        series.options = merge(series.options, options);
        fireEvent(series, 'afterUpdate');
        if (pick(redraw, true)) {
            series.chart.redraw();
        }
    };
    /* *
     *
     *  Static Properties
     *
     * */
    DataSeries.defaultOptions = {
        dataLabels: {
            enabled: false
        }
    };
    /* *
     *
     *  Static Functions
     *
     * */
    DataSeries.getSeriesOptionsFromTable = CS.getSeriesOptionsFromTable;
    DataSeries.getTableFromSeriesOptions = CS.getTableFromSeriesOptions;
    DataSeries.increment = CS.increment;
    return DataSeries;
}());
extend(DataSeries.prototype, {
    axisTypes: [],
    bindAxes: CS.prototype.bindAxes,
    drawLegendSymbol: LegendSymbolMixin.drawRectangle,
    insert: CS.prototype.insert,
    is: CS.prototype.is,
    parallelArrays: [],
    pointArrayMap: ['y'],
    pointClass: DataPoint,
    type: 'data',
    updateParallelArrays: CS.prototype.updateParallelArrays
});
/* *
 *
 *  Registry
 *
 * */
SeriesRegistry.registerSeriesType('data', DataSeries);
/* *
 *
 *  Default Export
 *
 * */
export default DataSeries;
