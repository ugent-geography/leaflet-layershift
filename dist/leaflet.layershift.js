'use strict';

L.LayerShift = L.Handler.extend({
    initialize: function(map, layer, options) {
        L.Handler.prototype.initialize.call(this, map);
        this.layer = layer;
        L.Util.setOptions(this, options || {});
    },

    addHooks: function() {
        this.pixelShift = L.point([0, 0]);
        this._shift(this.pixelShift);
        this.fgDraggable = new L.Draggable(this.layer._tileContainer);
        this.fgDraggable.enable();
        this.fgDraggable.on('drag', this._onDrag, this);
        this.bgDraggable = new L.Draggable(this.layer._bgBuffer);
        this.bgDraggable.enable();
        this.bgDraggable.on('drag', this._onDrag, this);
        this._map.on('zoomanim', this._animateZoom, this);
        this.layer.fire('shiftstart');
    },

    removeHooks: function() {
        this.pixelShift = L.point([0, 0]);
        this._shift(this.pixelShift);
        this.fgDraggable.off('drag', this._onDrag, this);
        this.fgDraggable.disable();
        this.fgDraggable = null;
        this.bgDraggable.off('drag', this._onDrag, this);
        this.bgDraggable.disable();
        this.bgDraggable = null;
        this._map.off('zoomanim', this._animateZoom, this);
        this.layer.fire('shiftend');
    },

    getShiftDistance: function() {
        var center = this._map.getCenter(),
            centerPixels = this._map.latLngToLayerPoint(center),
            shiftedPixels = centerPixels.add(this.pixelShift),
            shifted = this._map.layerPointToLatLng(shiftedPixels);

        return shifted.distanceTo(center);
    },

    getShiftAngle: function() {
        var angle =  Math.atan2(this.pixelShift.x, this.pixelShift.y);
        if(angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    },

    _onDrag: function(e) {
        this.pixelShift = L.DomUtil.getPosition(this.layer._tileContainer)
        this._shift(this.pixelShift);
    },

    _animateZoom: function(e) {
        this.pixelShift = this.pixelShift.divideBy(1 / e.scale);
        L.DomUtil.setPosition(this.layer._tileContainer, this.pixelShift);
    },

    _shift: function(offset, animate) {
        this.layer.offsetBounds(offset || L.point([0, 0]));
        L.DomUtil.setPosition(this.layer._tileContainer, offset);
        L.DomUtil.setPosition(this.layer._bgBuffer, offset);
        this.layer.fire('shift', {
            distance: this.getShiftDistance(),
            pixelDistance: this.pixelShift,
            angle: this.getShiftAngle()
        });
    }
});

L.ShiftableTileLayer = L.TileLayer.extend({
    _boundsOffset: L.point([0, 0]),

    onAdd: function(map) {
        this.layerShift = new L.LayerShift(map, this);
        L.TileLayer.prototype.onAdd.call(this, map);
    },

    _update: function () {

        if (!this._map) { return; }

        var map = this._map,
            bounds = map.getPixelBounds(),
            zoom = map.getZoom(),
            tileSize = this._getTileSize();

        if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
            return;
        }

        var tileBounds = L.bounds(
                bounds.min.subtract(this._boundsOffset).divideBy(tileSize)._floor(),
                bounds.max.subtract(this._boundsOffset).divideBy(tileSize)._floor());

        this._addTilesFromCenterOut(tileBounds);

        if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
            this._removeOtherTiles(tileBounds);
        }
    },

    offsetBounds: function(offset) {
        this._boundsOffset = offset;
        this._update();
    }
});

L.shiftableTileLayer = function(url, options) {
    return new L.ShiftableTileLayer(url, options);
}