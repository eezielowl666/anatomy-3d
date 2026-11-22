#!/usr/bin/env bash
# 下載 Z-Anatomy 原始肌肉／骨骼 FBX 到 tools/source/（約 80 MB，不需整個 repo）
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p source && rm -rf .za
git clone --depth 1 --filter=blob:none --no-checkout -b PC-Version https://github.com/LluisV/Z-Anatomy .za
cd .za
git show "HEAD:Resources/Models/FBX/MuscularSystem100.fbx" > ../source/Muscular.fbx
git show "HEAD:Resources/Models/FBX/SkeletalSystem100.fbx" > ../source/Skeletal.fbx
cd .. && rm -rf .za && ls -la source
