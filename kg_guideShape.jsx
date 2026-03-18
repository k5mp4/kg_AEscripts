// kg_guideShape.jsx
// Generates shape layers that fill the composition, divided by guides.
// No UI — runs immediately on the active composition.

(function kg_guideShape() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return;

    var w = comp.width;
    var h = comp.height;

    // Item.guides: array of {orientationType, positionType, position}
    // orientationType: 0 = horizontal guide (y position), 1 = vertical guide (x position)
    // Added in AE 16.1 (CC 2019)
    var guides = comp.guides;

    // Collect guide positions by orientation
    var vGuides = []; // vertical guides → x positions
    var hGuides = []; // horizontal guides → y positions

    for (var i = 0; i < guides.length; i++) {
        var g = guides[i];
        if (g.orientationType === 1) {
            vGuides.push(g.position);
        } else {
            hGuides.push(g.position);
        }
    }

    // Sort and build boundary arrays (comp edges + guide positions)
    vGuides.sort(function(a, b) { return a - b; });
    hGuides.sort(function(a, b) { return a - b; });

    var xs = [0].concat(vGuides).concat([w]);
    var ys = [0].concat(hGuides).concat([h]);

    var totalCells = (xs.length - 1) * (ys.length - 1);
    if (totalCells === 0) return;

    app.beginUndoGroup("kg_guideShape");

    var layerNum = 0;

    for (var row = 0; row < ys.length - 1; row++) {
        for (var col = 0; col < xs.length - 1; col++) {
            var x1 = xs[col],  x2 = xs[col + 1];
            var y1 = ys[row],  y2 = ys[row + 1];

            var cellW = x2 - x1;
            var cellH = y2 - y1;

            // Rect center in shape-layer local space
            // (shape layer anchor is at comp center by default)
            var cx = (x1 + x2) / 2 - w / 2;
            var cy = (y1 + y2) / 2 - h / 2;

            layerNum++;
            var grpName = "Rect";

            // --- Create shape layer ---
            var sl = comp.layers.addShape();
            sl.name = "Guide Shape " + layerNum
                    + " [" + col + "," + row + "]";
            var slIndex = sl.index;

            // --- Add vector group ---
            var contents = sl.property("ADBE Root Vectors Group");
            var grp = contents.addProperty("ADBE Vector Group");
            grp.name = grpName;

            // Re-acquire after DOM modification
            sl       = comp.layer(slIndex);
            contents = sl.property("ADBE Root Vectors Group");
            grp      = contents.property(grpName);

            // --- Add rectangle shape ---
            var grpContents = grp.property("ADBE Vectors Group");
            grpContents.addProperty("ADBE Vector Shape - Rect");

            // Re-acquire after DOM modification
            sl          = comp.layer(slIndex);
            contents    = sl.property("ADBE Root Vectors Group");
            grp         = contents.property(grpName);
            grpContents = grp.property("ADBE Vectors Group");

            // --- Add fill ---
            grpContents.addProperty("ADBE Vector Graphic - Fill");

            // Re-acquire after DOM modification
            sl          = comp.layer(slIndex);
            contents    = sl.property("ADBE Root Vectors Group");
            grp         = contents.property(grpName);
            grpContents = grp.property("ADBE Vectors Group");

            // --- Set rectangle size and position ---
            var rect = grpContents.property("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Size").setValue([cellW, cellH]);
            rect.property("ADBE Vector Rect Position").setValue([cx, cy]);
        }
    }

    app.endUndoGroup();
})();
