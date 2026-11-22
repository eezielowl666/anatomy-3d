# Anatomy 3D（人體解剖 3D）

互動式 3D 人體肌肉與骨骼解剖模型。點擊肌肉或骨骼可查看介紹。

## 檔案（四個要放在同一層資料夾）
- `index.html`：主頁面
- `data.js`：肌肉與骨骼的中文名稱、介紹資料
- `muscles.glb`：肌肉模型（約 4.3 MB）
- `bones.glb`：骨骼模型（約 1.5 MB）

直接雙擊 index.html 無法載入模型，必須放在網站上，或用本機伺服器開啟：
在此資料夾執行 `python3 -m http.server 8000`，再開 http://localhost:8000

## 方法 A：Netlify Drop（最快，不用 Git）
1. 開 https://app.netlify.com/drop
2. 把整個 `anatomy-3d` 資料夾拖進頁面
3. 取得 `xxxx.netlify.app` 網址，打開確認模型有載入
4. 註冊／登入 Netlify 認領這個網站（未認領的匿名網站可能會被移除）
5. 想改網址：在網站設定把名稱改成例如 `anatomy-3d`
6. 之後更新：把新資料夾拖到網站後台「Deploys」頁面的拖放區

## 方法 B：GitHub Pages（適合長期維護）
1. GitHub 建立 Public repository，例如 `anatomy-3d`
2. Add file → Upload files，上傳四個檔案，Commit
3. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save
4. 網址：`https://你的帳號.github.io/anatomy-3d/`

## 授權
3D 模型來自 [Z-Anatomy](https://github.com/LluisV/Z-Anatomy)（CC BY-SA 4.0），源自 BodyParts3D © DBCLS；
已簡化網格並調整體型。公開時須保留頁面左下角的來源標示，修改後的模型也須以相同授權釋出。
