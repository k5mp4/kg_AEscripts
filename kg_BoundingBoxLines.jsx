// BoundingBoxLines.jsx
// レイヤーのバウンディングボックスに沿った線を追加するスクリプト
// v1.2  - Shapeオブジェクト互換性修正版

(function(thisObj) {

    // バージョン情報
    var SCRIPT_VERSION = "v1.2";

    // デバッグログ機能
    var DEBUG_MODE = false;
    var debugLog = [];
    
    function log(message) {
        if (DEBUG_MODE) {
            var timestamp = new Date().toLocaleTimeString();
            var logMessage = "[" + timestamp + "] " + message;
            debugLog.push(logMessage);
            $.writeln(logMessage); // ExtendScript Toolkitのコンソールに出力
        }
    }
    
    function showDebugLog() {
        if (debugLog.length > 0) {
            var logText = debugLog.join("\n");
            alert("=== デバッグログ ===\n" + logText);
        }
    }
    
    // UI構築
    function buildUI(thisObj) {
        log("UI構築開始");

        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Bounding Box Lines " + SCRIPT_VERSION, undefined);

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        // タイトルとバージョン
        var titleGroup = win.add("group");
        titleGroup.orientation = "row";
        titleGroup.alignChildren = ["left", "center"];
        var titleText = titleGroup.add("statictext", undefined, "Bounding Box Lines");
        titleText.graphics.font = ScriptUI.newFont(titleText.graphics.font.name, "BOLD", 12);
        var versionText = titleGroup.add("statictext", undefined, SCRIPT_VERSION);
        versionText.graphics.foregroundColor = versionText.graphics.newPen(versionText.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

        // 説明
        var descGroup = win.add("group");
        descGroup.orientation = "column";
        descGroup.alignChildren = ["left", "top"];
        var desc = descGroup.add("statictext", undefined, "選択レイヤーのバウンディングボックスに", {multiline: true});
        var desc2 = descGroup.add("statictext", undefined, "沿った線を追加します");
        
        // 線の設定グループ
        var settingsGroup = win.add("panel", undefined, "線の設定");
        settingsGroup.orientation = "column";
        settingsGroup.alignChildren = ["fill", "top"];
        settingsGroup.spacing = 8;
        settingsGroup.margins = 10;
        
        // 線幅
        var widthGroup = settingsGroup.add("group");
        widthGroup.add("statictext", undefined, "線幅:");
        var widthEdit = widthGroup.add("edittext", undefined, "2");
        widthEdit.characters = 6;
        widthGroup.add("statictext", undefined, "px");
        
        // 色設定（白固定）
        var colorGroup = settingsGroup.add("group");
        colorGroup.add("statictext", undefined, "線の色:");
        var colorLabel = colorGroup.add("statictext", undefined, "白色（固定）");
        
        var selectedColor = [1, 1, 1]; // 白色固定

        // 線の範囲設定
        var extentGroup = settingsGroup.add("group");
        extentGroup.orientation = "column";
        extentGroup.alignChildren = ["left", "top"];
        extentGroup.add("statictext", undefined, "線の範囲:");

        var extentRadioGroup = settingsGroup.add("group");
        extentRadioGroup.orientation = "column";
        extentRadioGroup.alignChildren = ["left", "top"];
        extentRadioGroup.spacing = 5;
        var extentBBoxRadio = extentRadioGroup.add("radiobutton", undefined, "バウンディングボックス内");
        var extentScreenRadio = extentRadioGroup.add("radiobutton", undefined, "画面外まで伸ばす");
        extentBBoxRadio.value = true; // デフォルトはバウンディングボックス内

        // 伸ばす倍率設定（画面外まで伸ばす場合のみ）
        var extensionGroup = settingsGroup.add("group");
        extensionGroup.alignChildren = ["left", "center"];
        extensionGroup.add("statictext", undefined, "  伸ばす倍率:");
        var extensionDropdown = extensionGroup.add("dropdownlist", undefined, ["1.5倍", "2倍", "3倍"]);
        extensionDropdown.selection = 2; // デフォルトは3倍
        extensionDropdown.enabled = false; // 初期状態は無効

        // ラジオボタンの変更イベント
        extentBBoxRadio.onClick = function() {
            extensionDropdown.enabled = false;
        };
        extentScreenRadio.onClick = function() {
            extensionDropdown.enabled = true;
        };

        // トリミング制御
        var trimGroup = settingsGroup.add("group");
        var trimCheck = trimGroup.add("checkbox", undefined, "トリミング制御を追加");
        trimCheck.value = true;

        // デバッグモード
        var debugGroup = settingsGroup.add("group");
        var debugCheck = debugGroup.add("checkbox", undefined, "デバッグログを表示");
        debugCheck.value = false;
        
        // 実行ボタン
        var buttonGroup = win.add("group");
        buttonGroup.alignment = ["fill", "top"];
        var applyBtn = buttonGroup.add("button", undefined, "適用", {name: "ok"});
        var cancelBtn = buttonGroup.add("button", undefined, "キャンセル", {name: "cancel"});
        
        // 適用ボタンの処理
        applyBtn.onClick = function() {
            log("=== 適用ボタンクリック ===");
            debugLog = []; // ログをリセット
            DEBUG_MODE = debugCheck.value;
            
            var comp = app.project.activeItem;
            log("アクティブアイテム取得: " + (comp ? comp.name : "null"));
            
            if (!comp || !(comp instanceof CompItem)) {
                log("エラー: アクティブなコンポジションがありません");
                alert("アクティブなコンポジションがありません");
                return;
            }
            
            var selectedLayers = comp.selectedLayers;
            log("選択レイヤー数: " + selectedLayers.length);
            
            if (selectedLayers.length === 0) {
                log("エラー: レイヤーが選択されていません");
                alert("レイヤーを選択してください");
                return;
            }
            
            // 倍率を取得（1.5, 2, 3のいずれか）
            var extensionMultiplier = 3; // デフォルト
            if (extensionDropdown.selection !== null) {
                switch(extensionDropdown.selection.index) {
                    case 0: extensionMultiplier = 1.5; break;
                    case 1: extensionMultiplier = 2; break;
                    case 2: extensionMultiplier = 3; break;
                }
            }

            var settings = {
                lineWidth: parseFloat(widthEdit.text) || 2,
                color: selectedColor,
                addTrimControl: trimCheck.value,
                extendOffscreen: extentScreenRadio.value, // trueなら画面外まで、falseならバウンディングボックス内
                extensionMultiplier: extensionMultiplier // 伸ばす倍率
            };

            log("設定: 線幅=" + settings.lineWidth + ", トリミング=" + settings.addTrimControl +
                ", 画面外=" + settings.extendOffscreen + ", 倍率=" + settings.extensionMultiplier);
            
            app.beginUndoGroup("Add Bounding Box Lines");
            
            try {
                for (var i = 0; i < selectedLayers.length; i++) {
                    log("--- レイヤー " + (i+1) + "/" + selectedLayers.length + " 処理開始 ---");
                    log("レイヤー名: " + selectedLayers[i].name);
                    addBoundingBoxLines(comp, selectedLayers[i], settings);
                    log("レイヤー " + (i+1) + " 処理完了");
                }
                
                log("=== すべての処理完了 ===");

                if (DEBUG_MODE) {
                    showDebugLog();
                    alert("線を追加しました！");
                }
                
            } catch(e) {
                log("!!! エラー発生 !!!");
                log("エラー内容: " + e.toString());
                log("エラー行: " + (e.line || "不明"));
                log("スタック: " + (e.stack || "なし"));
                
                var errorMsg = "エラーが発生しました:\n" + e.toString();
                if (e.line) {
                    errorMsg += "\n行番号: " + e.line;
                }
                alert(errorMsg);
                
                if (DEBUG_MODE) {
                    showDebugLog();
                }
            }
            
            app.endUndoGroup();
        };
        
        cancelBtn.onClick = function() {
            log("キャンセルボタンクリック");
            win.close();
        };
        
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };
        
        log("UI構築完了");
        
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
        
        return win;
    }
    
    // メイン処理：バウンディングボックスの線を追加
    function addBoundingBoxLines(comp, layer, settings) {
        log("addBoundingBoxLines 開始");
        
        try {
            // レイヤーのソース矩形を取得
            log("sourceRectAtTime 取得試行");
            var sourceRect = layer.sourceRectAtTime(comp.time, false);
            log("sourceRect: left=" + sourceRect.left + ", top=" + sourceRect.top +
                ", width=" + sourceRect.width + ", height=" + sourceRect.height);

            // 現在のスケールを取得（作成時のスケールを記録）
            var initialScale = layer.transform.scale.value;
            log("初期スケール: X=" + initialScale[0] + "%, Y=" + initialScale[1] + "%");

            // バウンディングボックスの4辺の情報
            var edges = [
                {name: "Top"},
                {name: "Bottom"},
                {name: "Left"},
                {name: "Right"}
            ];
            
            var lineLayers = [];

            // 親レイヤーにエフェクトコントロールを追加（初回のみ）
            log("親レイヤーにエフェクトコントロール追加");
            var parentEffects = layer.property("ADBE Effect Parade");

            // 既存のコントロールをチェック
            var hasControls = false;
            for (var j = 1; j <= parentEffects.numProperties; j++) {
                if (parentEffects.property(j).name === "BBox Line Width") {
                    hasControls = true;
                    log("  既存のエフェクトコントロールを検出");
                    break;
                }
            }

            if (!hasControls) {
                var parentLineWidth = parentEffects.addProperty("ADBE Slider Control");
                parentLineWidth.name = "BBox Line Width";
                parentLineWidth.property("ADBE Slider Control-0001").setValue(settings.lineWidth);
                log("  Line Width コントロール追加");

                var parentLineColor = parentEffects.addProperty("ADBE Color Control");
                parentLineColor.name = "BBox Line Color";
                parentLineColor.property("ADBE Color Control-0001").setValue(settings.color);
                log("  Line Color コントロール追加");

                var parentMargin = parentEffects.addProperty("ADBE Slider Control");
                parentMargin.name = "BBox Margin";
                parentMargin.property("ADBE Slider Control-0001").setValue(0);
                log("  Margin コントロール追加");

                if (settings.addTrimControl) {
                    var parentTrimStart = parentEffects.addProperty("ADBE Slider Control");
                    parentTrimStart.name = "BBox Trim Start";
                    parentTrimStart.property("ADBE Slider Control-0001").setValue(0);

                    var parentTrimEnd = parentEffects.addProperty("ADBE Slider Control");
                    parentTrimEnd.name = "BBox Trim End";
                    parentTrimEnd.property("ADBE Slider Control-0001").setValue(100);
                    log("  Trim コントロール追加");
                }
            }
            log("親レイヤーエフェクトコントロール設定完了");

            for (var i = 0; i < edges.length; i++) {
                var edge = edges[i];
                var lineName = layer.name + "_L_" + edge.name;
                log("線レイヤー作成: " + lineName + " (親: " + layer.name + ")");

                // シェイプレイヤー作成
                log("  addShape 呼び出し");
                var shapeLayer = comp.layers.addShape();
                shapeLayer.name = lineName;
                log("  シェイプレイヤー作成完了: " + shapeLayer.name);
                
                // レイヤーを元レイヤーの上に配置
                log("  moveBefore 呼び出し");
                shapeLayer.moveBefore(layer);
                
                // 親子関係を設定
                log("  親子関係設定");
                shapeLayer.parent = layer;
                
                // シェイプグループ作成
                log("  シェイプグループ作成");
                var rootVectors = shapeLayer.property("ADBE Root Vectors Group");
                log("  rootVectors取得完了");
                
                var shapeGroup = rootVectors.addProperty("ADBE Vector Group");
                shapeGroup.name = "Line " + edge.name;
                log("  シェイプグループ追加完了");
                
                var contentsGroup = shapeGroup.property("ADBE Vectors Group");
                log("  contentsGroup取得完了");

                // パスデータ生成（先に生成）
                log("  パスデータ生成: " + edge.name);
                var pathData = createPathForEdge(edge.name, sourceRect, comp, settings);
                log("  パスデータ生成完了");

                // パス作成と設定
                log("  パス作成");
                var pathGroup = contentsGroup.addProperty("ADBE Vector Shape - Group");
                log("  pathGroup追加完了");

                // パスに値を設定（すぐに設定）
                log("  パスに値を設定");
                try {
                    var pathProperty = pathGroup.property("ADBE Vector Shape");
                    if (!pathProperty) {
                        log("    'ADBE Vector Shape'がnull、インデックス1で試行");
                        pathProperty = pathGroup.property(1);
                    }
                    log("    pathProperty取得: " + (pathProperty ? pathProperty.matchName : "null"));

                    pathProperty.setValue(pathData);
                    log("  パス設定完了");

                    // 余白を反映するエクスプレッションを追加
                    log("  パス余白エクスプレッション設定 (辺: " + edge.name + ")");
                    try {
                        var marginExpression = generateMarginExpression(edge.name, sourceRect, settings, initialScale);
                        log("  === 生成されたエクスプレッション全体 (" + edge.name + ") ===");
                        log(marginExpression);
                        log("  === エクスプレッション終了 ===");
                        pathProperty.expression = marginExpression;
                        log("  パス余白エクスプレッション設定完了 (" + edge.name + ")");
                    } catch(exprErr) {
                        log("  !!! パスエクスプレッションエラー (" + edge.name + ") !!!");
                        log("  エラー: " + exprErr.toString());
                        log("  エラー行: " + (exprErr.line || "不明"));
                        // エクスプレッション設定に失敗しても続行
                    }
                } catch(e) {
                    log("  パス設定エラー: " + e.toString());
                    throw e;
                }

                // ストローク追加
                log("  ストローク追加");
                var stroke = contentsGroup.addProperty("ADBE Vector Graphic - Stroke");
                stroke.property("ADBE Vector Stroke Color").setValue(settings.color);
                stroke.property("ADBE Vector Stroke Width").setValue(settings.lineWidth);

                // ストロークを外側に配置（辺の向きに応じて設定）
                // Top/Bottomは上下、Left/Rightは左右に伸びるように
                try {
                    var strokeAlign = stroke.property("ADBE Vector Stroke Line Join");
                    if (strokeAlign) {
                        strokeAlign.setValue(2); // 2 = Outside（外側）
                        log("  ストローク配置を外側に設定");
                    }
                } catch(e) {
                    log("  ストローク配置設定エラー（無視）: " + e.toString());
                }

                log("  ストローク設定完了");
                
                // トリミングパス（オプション）
                if (settings.addTrimControl) {
                    log("  トリミングパス追加");
                    contentsGroup.addProperty("ADBE Vector Filter - Trim");
                    log("  トリミングパス追加完了");
                }

                // 親レイヤー名を取得
                var parentLayerName = layer.name;

                // エクスプレッション設定（親レイヤーのエフェクトコントロールにリンク）
                // すべてのプロパティ追加後に、contentsGroupから再取得して設定
                log("  エクスプレッション設定（親レイヤー参照）");
                log("  contentsGroup.numProperties: " + contentsGroup.numProperties);

                // ストロークとトリムを再取得
                var strokeProp = null;
                var trimProp = null;

                for (var j = 1; j <= contentsGroup.numProperties; j++) {
                    var prop = contentsGroup.property(j);
                    log("    Property " + j + ": " + prop.matchName + " (" + prop.name + ")");

                    if (prop.matchName === "ADBE Vector Graphic - Stroke") {
                        strokeProp = prop;
                        log("    ストローク発見");
                    } else if (prop.matchName === "ADBE Vector Filter - Trim") {
                        trimProp = prop;
                        log("    トリム発見");
                    }
                }

                // 線幅のエクスプレッション（親のスケールで割ることで、スケールの影響を打ち消す）
                // 水平線（Top/Bottom）はYスケール、垂直線（Left/Right）はXスケールで補正
                if (strokeProp) {
                    try {
                        var widthProp = strokeProp.property("ADBE Vector Stroke Width");
                        log("    widthProp取得: " + (widthProp ? widthProp.matchName : "null"));

                        // 辺の向きに応じたスケール補正
                        var scaleIndex;
                        var scaleDimension;
                        if (edge.name === "Top" || edge.name === "Bottom") {
                            // 水平線 → Yスケール（垂直方向の圧縮）で補正
                            scaleIndex = 1;
                            scaleDimension = "Y";
                        } else {
                            // 垂直線 → Xスケール（水平方向の圧縮）で補正
                            scaleIndex = 0;
                            scaleDimension = "X";
                        }

                        log("    スケール補正: " + edge.name + " → " + scaleDimension + "スケール");
                        log("    初期スケール: " + initialScale[scaleIndex] + "%");

                        var widthExpression =
                            'var parentLayer = thisLayer.parent;' +
                            'var baseWidth = parentLayer.effect("BBox Line Width")(1);' +
                            'var currentScale = parentLayer.transform.scale.value[' + scaleIndex + '];' +
                            'var initialScale = ' + initialScale[scaleIndex] + ';' +
                            'var scaleRatio = currentScale / initialScale;' +
                            'baseWidth / scaleRatio;';

                        log("    エクスプレッション設定試行");
                        widthProp.expression = widthExpression;
                        log("    線幅エクスプレッション設定完了");
                    } catch(e) {
                        log("    線幅エクスプレッションエラー: " + e.toString());
                        log("    エラー行: " + (e.line || "不明"));
                    }

                    // 線色のエクスプレッション
                    try {
                        var colorProp = strokeProp.property("ADBE Vector Stroke Color");
                        colorProp.expression = 'thisLayer.parent.effect("BBox Line Color")(1)';
                        log("    線色エクスプレッション設定完了");
                    } catch(e) {
                        log("    線色エクスプレッションエラー: " + e.toString());
                    }
                } else {
                    log("    !!! ストロークプロパティが見つかりません !!!");
                }

                // トリミングのエクスプレッション
                // Bottom と Right は Start/End を反転させて、アニメーションが中心から外側に広がるようにする
                if (settings.addTrimControl && trimProp) {
                    var invertTrim = (edge.name === "Bottom" || edge.name === "Right");
                    log("    Trim反転: " + invertTrim + " (edge: " + edge.name + ")");

                    try {
                        var trimStartProp = trimProp.property("ADBE Vector Trim Start");
                        if (invertTrim) {
                            // 反転: Trim End の値を使用（100 - 値）
                            trimStartProp.expression = '100 - thisLayer.parent.effect("BBox Trim End")(1)';
                        } else {
                            // 通常: Trim Start の値を使用
                            trimStartProp.expression = 'thisLayer.parent.effect("BBox Trim Start")(1)';
                        }
                        log("    Trim Startエクスプレッション設定完了");
                    } catch(e) {
                        log("    Trim Startエクスプレッションエラー: " + e.toString());
                    }

                    try {
                        var trimEndProp = trimProp.property("ADBE Vector Trim End");
                        if (invertTrim) {
                            // 反転: Trim Start の値を使用（100 - 値）
                            trimEndProp.expression = '100 - thisLayer.parent.effect("BBox Trim Start")(1)';
                        } else {
                            // 通常: Trim End の値を使用
                            trimEndProp.expression = 'thisLayer.parent.effect("BBox Trim End")(1)';
                        }
                        log("    Trim Endエクスプレッション設定完了");
                    } catch(e) {
                        log("    Trim Endエクスプレッションエラー: " + e.toString());
                    }
                }
                log("  エクスプレッション設定完了");

                // 位置とアンカーポイントの調整
                log("  位置・アンカーポイント調整");
                shapeLayer.position.setValue([0, 0]);
                shapeLayer.anchorPoint.setValue([0, 0]);
                
                lineLayers.push(shapeLayer);
                log("線レイヤー " + edge.name + " 完了");
            }
            
            log("addBoundingBoxLines 完了");
            return lineLayers;
            
        } catch(e) {
            log("!!! addBoundingBoxLines内でエラー !!!");
            log("エラー: " + e.toString());
            throw e;
        }
    }
    
    // 余白を反映するエクスプレッションを生成
    function generateMarginExpression(edgeName, sourceRect, settings, initialScale) {
        var left = sourceRect.left;
        var top = sourceRect.top;
        var width = sourceRect.width;
        var height = sourceRect.height;

        var expression = '';
        expression += 'var parentLayer = thisLayer.parent;\n';
        expression += 'var baseMargin = parentLayer.effect("BBox Margin")(1);\n';
        expression += 'var baseLineWidth = parentLayer.effect("BBox Line Width")(1);\n';
        expression += 'var parentScale = parentLayer.transform.scale.value;\n';
        expression += 'var initialScale = [' + initialScale[0] + ', ' + initialScale[1] + '];\n';

        // 辺の向きに応じたスケール補正を適用
        var scaleIndex;
        if (edgeName === "Top" || edgeName === "Bottom") {
            // 水平線 → Yスケールで補正
            scaleIndex = 1;
        } else {
            // 垂直線 → Xスケールで補正
            scaleIndex = 0;
        }

        expression += 'var scaleCompensation = parentScale[' + scaleIndex + '] / 100;\n';
        expression += 'var initialScaleCompensation = initialScale[' + scaleIndex + '] / 100;\n';
        expression += 'var margin = baseMargin / scaleCompensation;\n';
        expression += 'var lineWidth = baseLineWidth / scaleCompensation;\n';
        expression += 'var halfWidth = lineWidth / 2;\n';

        // sourceRectの値を初期スケールで補正
        expression += 'var left = ' + left + ' * initialScaleCompensation;\n';
        expression += 'var top = ' + top + ' * initialScaleCompensation;\n';
        expression += 'var width = ' + width + ' * initialScaleCompensation;\n';
        expression += 'var height = ' + height + ' * initialScaleCompensation;\n';

        if (settings.extendOffscreen) {
            var multiplier = settings.extensionMultiplier || 3;
            expression += 'var extension = Math.max(thisComp.width, thisComp.height) * ' + multiplier + ';\n';
        }

        // 各辺のパスを生成
        var point1, point2;

        switch(edgeName) {
            case "Top":
                // Top線は上方向（-Y）に線幅の半分＋余白を移動
                if (settings.extendOffscreen) {
                    expression += 'var y = top - margin - halfWidth;\n';
                    expression += 'createPath([[left - extension, y], [left + width + extension, y]], [], [], false);';
                } else {
                    expression += 'var y = top - margin - halfWidth;\n';
                    expression += 'createPath([[left, y], [left + width, y]], [], [], false);';
                }
                break;

            case "Bottom":
                // Bottom線は下方向（+Y）に線幅の半分＋余白を移動
                if (settings.extendOffscreen) {
                    expression += 'var y = top + height + margin + halfWidth;\n';
                    expression += 'createPath([[left - extension, y], [left + width + extension, y]], [], [], false);';
                } else {
                    expression += 'var y = top + height + margin + halfWidth;\n';
                    expression += 'createPath([[left, y], [left + width, y]], [], [], false);';
                }
                break;

            case "Left":
                // Left線は左方向（-X）に線幅の半分＋余白を移動
                if (settings.extendOffscreen) {
                    expression += 'var x = left - margin - halfWidth;\n';
                    expression += 'createPath([[x, top - extension], [x, top + height + extension]], [], [], false);';
                } else {
                    expression += 'var x = left - margin - halfWidth;\n';
                    expression += 'createPath([[x, top], [x, top + height]], [], [], false);';
                }
                break;

            case "Right":
                // Right線は右方向（+X）に線幅の半分＋余白を移動
                if (settings.extendOffscreen) {
                    expression += 'var x = left + width + margin + halfWidth;\n';
                    expression += 'createPath([[x, top - extension], [x, top + height + extension]], [], [], false);';
                } else {
                    expression += 'var x = left + width + margin + halfWidth;\n';
                    expression += 'createPath([[x, top], [x, top + height]], [], [], false);';
                }
                break;
        }

        return expression;
    }

    // 各辺のパスを生成
    function createPathForEdge(edgeName, sourceRect, comp, settings) {
        log("    createPathForEdge: " + edgeName);
        log("    extendOffscreen: " + settings.extendOffscreen);

        var left = sourceRect.left;
        var top = sourceRect.top;
        var width = sourceRect.width;
        var height = sourceRect.height;

        var pathPoints = [];

        if (settings.extendOffscreen) {
            // 画面外まで伸ばすモード（設定された倍率まで）
            var compWidth = comp.width;
            var compHeight = comp.height;
            var multiplier = settings.extensionMultiplier || 3;
            var extension = Math.max(compWidth, compHeight) * multiplier;

            log("    伸ばす倍率: " + multiplier + "倍");
            log("    extension: " + extension);

            switch(edgeName) {
                case "Top":
                    pathPoints = [
                        [left - extension, top],
                        [left + width + extension, top]
                    ];
                    log("    Top線（画面外 " + multiplier + "倍）: y=" + top);
                    break;

                case "Bottom":
                    pathPoints = [
                        [left - extension, top + height],
                        [left + width + extension, top + height]
                    ];
                    log("    Bottom線（画面外 " + multiplier + "倍）: y=" + (top + height));
                    break;

                case "Left":
                    pathPoints = [
                        [left, top - extension],
                        [left, top + height + extension]
                    ];
                    log("    Left線（画面外 " + multiplier + "倍）: x=" + left);
                    break;

                case "Right":
                    pathPoints = [
                        [left + width, top - extension],
                        [left + width, top + height + extension]
                    ];
                    log("    Right線（画面外 " + multiplier + "倍）: x=" + (left + width));
                    break;
            }
        } else {
            // バウンディングボックス内モード
            switch(edgeName) {
                case "Top":
                    pathPoints = [
                        [left, top],
                        [left + width, top]
                    ];
                    log("    Top線（BBox内）: y=" + top + ", x=" + left + " to " + (left + width));
                    break;

                case "Bottom":
                    pathPoints = [
                        [left, top + height],
                        [left + width, top + height]
                    ];
                    log("    Bottom線（BBox内）: y=" + (top + height) + ", x=" + left + " to " + (left + width));
                    break;

                case "Left":
                    pathPoints = [
                        [left, top],
                        [left, top + height]
                    ];
                    log("    Left線（BBox内）: x=" + left + ", y=" + top + " to " + (top + height));
                    break;

                case "Right":
                    pathPoints = [
                        [left + width, top],
                        [left + width, top + height]
                    ];
                    log("    Right線（BBox内）: x=" + (left + width) + ", y=" + top + " to " + (top + height));
                    break;
            }
        }
        
        // タンジェントは全て0（直線）
        var inTangents = [];
        var outTangents = [];
        for (var i = 0; i < pathPoints.length; i++) {
            inTangents.push([0, 0]);
            outTangents.push([0, 0]);
        }
        
        log("    Shapeオブジェクト生成");
        var pathShape = new Shape();
        pathShape.vertices = pathPoints;
        pathShape.inTangents = inTangents;
        pathShape.outTangents = outTangents;
        pathShape.closed = false;
        
        log("    pathShape生成完了");
        return pathShape;
    }
    
    // UI表示
    log("スクリプト起動");
    buildUI(thisObj);
    
})(this);
