// kg_bufferPrecomp.jsx
// 選択レイヤーを 120 フレームのバッファ付きでプリコンポーズするスクリプト
// v1.1.0

(function () {

    var BUFFER_FRAMES = 120;

    // ============================================================
    // 前処理チェック
    // ============================================================

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("アクティブなコンポジションを開いてください。");
        return;
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        alert("レイヤーを選択してください。");
        return;
    }

    // ============================================================
    // 名前入力ダイアログ
    // ============================================================

    var dlg = new Window("dialog", "Buffer Precompose");
    dlg.orientation   = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.margins       = 15;
    dlg.spacing       = 8;

    dlg.add("statictext", undefined, "プリコンポーズ名:");
    var nameInput = dlg.add("edittext", undefined, "Precomp");
    nameInput.characters = 32;
    nameInput.active     = true;

    var hintText = dlg.add("statictext", undefined,
        "バッファ: " + BUFFER_FRAMES + " フレーム（前後）");
    hintText.enabled = false;

    var btnGroup = dlg.add("group");
    btnGroup.alignment = ["center", "top"];
    btnGroup.spacing   = 8;
    var okBtn = btnGroup.add("button", undefined, "OK",         { name: "ok" });
                btnGroup.add("button", undefined, "キャンセル", { name: "cancel" });
    dlg.defaultElement = okBtn;

    if (dlg.show() !== 1) return;

    var precompName = nameInput.text;
    if (precompName === "") {
        alert("名前を入力してください。");
        return;
    }

    // ============================================================
    // 時間計算
    // ============================================================

    var fps        = comp.frameRate;
    var bufferTime = BUFFER_FRAMES / fps;

    // 選択レイヤーの時間範囲（inPoint / outPoint ベース）
    var earliestStart = Infinity;
    var latestEnd     = -Infinity;
    for (var i = 0; i < selectedLayers.length; i++) {
        var ly = selectedLayers[i];
        if (ly.inPoint  < earliestStart) earliestStart = ly.inPoint;
        if (ly.outPoint > latestEnd)     latestEnd     = ly.outPoint;
    }
    var contentDuration = latestEnd - earliestStart;

    // レイヤーインデックス収集（昇順）
    var layerIndices = [];
    for (var i = 0; i < selectedLayers.length; i++) {
        layerIndices.push(selectedLayers[i].index);
    }
    layerIndices.sort(function (a, b) { return a - b; });

    // ============================================================
    // precompose 前のプロジェクトアイテム ID を記録
    // ============================================================

    var existingIds = {};
    for (var k = 1; k <= app.project.numItems; k++) {
        existingIds[app.project.item(k).id] = true;
    }

    // ============================================================
    // プリコンポーズ実行
    // ============================================================

    app.beginUndoGroup("Buffer Precompose");

    try {
        // precompose（moveAllAttributes=true でエフェクト等も移動）
        comp.layers.precompose(layerIndices, precompName, true);

        // ---- 新しく生成されたプリコンプアイテムを特定 ----
        var precompItem = null;
        for (var k = 1; k <= app.project.numItems; k++) {
            var item = app.project.item(k);
            if ((item instanceof CompItem) && !existingIds[item.id]) {
                precompItem = item;
                break;
            }
        }
        if (!precompItem) {
            throw new Error("プリコンプアイテムが見つかりませんでした。");
        }

        // ---- 親コンプ内のプリコンプレイヤーを特定 ----
        var precompLayer = null;
        for (var k = 1; k <= comp.numLayers; k++) {
            var testLayer = comp.layer(k);
            if (testLayer.source && testLayer.source.id === precompItem.id) {
                precompLayer = testLayer;
                break;
            }
        }
        if (!precompLayer) {
            throw new Error("プリコンプレイヤーが見つかりませんでした。");
        }

        // ---- precomp 内レイヤーをバッファ分だけ右にシフト ----
        // シフト量: コンテンツ先頭が precomp の bufferTime 位置に来るようにする
        // 例: earliestStart=2s, bufferTime=4s → shift=+2s
        //     レイヤー(2s-5s) → (4s-7s)、先頭 4s が空バッファ
        var shift = bufferTime - earliestStart;
        for (var j = 1; j <= precompItem.numLayers; j++) {
            precompItem.layer(j).startTime += shift;
        }

        // ---- precomp のデュレーションを設定 ----
        precompItem.duration = contentDuration + bufferTime * 2;

        // ---- 親コンプでの precomp レイヤーを位置合わせ ----
        // startTime を設定することで先頭バッファが earliestStart より前に来る
        // precomp 内の bufferTime = 親コンプの earliestStart に対応
        // startTime でバッファ分だけ前にずらし、
        // inPoint/outPoint で元の選択範囲だけが見えるようにトリム
        precompLayer.startTime = earliestStart - bufferTime;
        precompLayer.inPoint   = earliestStart;
        precompLayer.outPoint  = latestEnd;

    } catch (e) {
        alert("エラーが発生しました:\n" + e.toString());
    }

    app.endUndoGroup();

})();
