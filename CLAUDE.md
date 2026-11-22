# Anatomy 3D — 專案說明（給 Claude Code）

互動式 3D 人體肌肉／骨骼解剖網站，部署在 GitHub Pages（main 分支根目錄）。
使用者 EZ 以繁體中文溝通；介面文字一律使用繁體中文（台灣用語）。

## 結構
- `index.html`：整個網站（three.js 0.160 透過 jsDelivr importmap 載入、UI、互動邏輯）。
- `data.js`：資料。
  - `ZH`：肌肉英文名（模型節點 base name）→ [中文名, 部位代碼 H/T/B/U/L/P]
  - `DETAILS`：肌群詳細介紹（bases 陣列對應多個肌肉；起點、止點、功能、訓練、小知識）
  - `boneInfo()` + `BONE_DETAILS`：骨骼中文名與 27 個骨群介紹（類型、關節、附著肌肉、功能、傷害、小知識）
- `muscles.glb` / `bones.glb`：模型（meshopt 壓縮 + 量化；每個 mesh 的 extras：b=名稱、s=l/r 左右、c=muscle/tendon/bone）。
- `tools/`：模型轉檔工具（不影響網站執行）。

## 常見任務
- 修改／新增介紹文字：只改 `data.js`。新增肌群介紹時，在 DETAILS 加一筆，bases 用 `ZH` 裡的 key。
- 介面調整：改 `index.html`。
- 改體型（例如加大肩膀）：調整 `tools/convert.mjs` 的 BLOBS，再重新產生 muscles.glb：
  1. `cd tools && npm install && ./fetch-source.sh`
  2. `node convert.mjs source/Muscular.fbx ../muscles.glb muscle 0.55 buff`
- 重新產生骨骼：`node convert.mjs source/Skeletal.fbx ../bones.glb bone 0.6`
- 牙齒在 index.html 載入時往後移 5 mm（incisor/canine/molar 節點）；軟骨已在轉檔時排除。

## 本機測試
在專案根目錄執行 `python3 -m http.server 8000`，開 http://localhost:8000
（直接雙擊 index.html 會因瀏覽器限制而無法載入模型。）

## 發佈
`git add -A && git commit -m "..." && git push`，GitHub Pages 約 1–3 分鐘後自動更新。

## 授權（務必保留）
模型來自 Z-Anatomy（CC BY-SA 4.0），源自 BodyParts3D © DBCLS。
頁面左下角 `#credit` 的來源標示不可移除；修改後的模型須以 CC BY-SA 4.0 釋出。
