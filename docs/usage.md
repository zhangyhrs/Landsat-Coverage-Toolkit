# 使用指南 / User Guide

## 中文指南

### 1. 运行环境
需具有 Google Earth Engine 使用权限，并在 Code Editor 中关联可用的 Cloud Project。脚本为 JavaScript，**不需要安装 Python**。

### 2. 影像覆盖分析
在 [GEE Code Editor](https://code.earthengine.google.com/) 中运行 [coverage_explorer.js](../gee/coverage_explorer.js)，按菜单选择数据源、年份、省份或 GAUL 下级行政单位。季度、月份支持复选多选；点击「运行多时段分析」后，统计任务按时段依次完成。

结果包括景数、不同 WRS Path/Row 组合数、覆盖率、覆盖面积和估算未压缩数据量。可在图层管理中切换覆盖图，通过下载菜单按时段生成 PNG、GeoJSON、CSV，或提交 SHP 到 Google Drive 的 Tasks。

### 3. 已有产品接合表下载
在 Code Editor 运行 [product_selector.js](../gee/product_selector.js)。将带 `PRODUCT_ID` 的逐景接合表上传至 **GEE Assets** 并填写 Asset 路径，或从 CSV 粘贴产品 ID（支持逗号/空格分隔）。逐景勾选后可以预览，并在 Tasks 中启动 GeoTIFF 导出。单批导出任务数量限制在脚本的 `maxTaskCount` 配置中。

### 4. 字段要求
接合表主键字段为 `PRODUCT_ID`，匹配 GEE 影像属性 `LANDSAT_PRODUCT_ID`。其余信息可包括 `SCENE_ID`、`DATE`、`SATELLITE`、`WRS_PATH`、`WRS_ROW`、`CLOUD_PCT`。

### 5. 常见问题
- **没有行政区：** FAO GAUL 2015 名称与行政层级可能不一致，请先确认筛选字段与现行区划对应关系。
- **Too many concurrent aggregations / capacity exceeded：** 减少季度或月份，或将统计尺度调至 5000 米。
- **没有产品：** 确认年份和平台；Landsat 9 不适用于 2021 年10月之前的数据。
- **需要原始 USGS 归档产品：** GEE GeoTIFF 导出不是官方原版 TAR/ZIP，请使用 USGS EarthExplorer。
- **数据量是否真实：** 目前为按假定场景尺寸与未压缩波段位深计算的粗略估算，非文件实际大小。

## English Guide

### Requirements
A Google Earth Engine account with an available Cloud Project; no local Python installation is needed.

### Coverage Explorer
Copy [coverage_explorer.js](../gee/coverage_explorer.js) to the Code Editor, select the satellite source, year, geographic area, and one or several quarters/months. Run the analysis and inspect coverage and scene-count summaries. Create PNG, GeoJSON, CSV links, or start SHP export tasks as needed.

### Product Selector
Load [product_selector.js](../gee/product_selector.js). Provide the GEE Asset path of a scene index with a `PRODUCT_ID` property or paste product identifiers. Select images, preview RGB, and launch GeoTIFF export tasks via the **Tasks** pane.

### Notes
Coverage uses non-Fill observations without cloud masking. GAUL 2015 boundaries are historical. Estimated GB values are theoretical and uncompressed. A GEE-exported GeoTIFF is not an original USGS product archive. For errors, check permissions, Cloud Project configuration, and Earth Engine usage quotas.
