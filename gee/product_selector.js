/***************************************************************
 * Landsat 8/9 已有产品选景与导出 GUI V1.1
 * 适用于 GEE Code Editor (JavaScript)
 *
 * 两种导入方式：
 * A. GEE Assets 矢量接合表（FeatureCollection，包含 PRODUCT_ID）
 * B. 直接粘贴 LANDSAT_PRODUCT_ID，逗号/换行分隔
 *
 * 按产品ID精确定位 GEE 中 Collection 2 Tier 1 Level 2 影像，
 * 选择单景或多景，导出保留原始DN的波段 GeoTIFF 到 Google Drive。
 * 注意：GEE 导出的 GeoTIFF 不是 USGS 原版 TAR 产品压缩包。
 ***************************************************************/

var CONFIG = {
  defaultAsset: '',
  pageSize: 30,
  maxTaskCount: 12,
  folder: 'GEE_Landsat_Selected',
  scale: 30
};

var L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var L9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
var ALL = L8.merge(L9);

ui.root.clear();
var panel = ui.Panel({style: {width: '440px', padding: '12px'}});
var map = ui.Map();
map.setOptions('SATELLITE');
map.setCenter(88, 31, 6);
ui.root.add(ui.SplitPanel({firstPanel: panel, secondPanel: map, wipe: false}));

function label(t, color, size) {
  return ui.Label(t, {
    fontSize: size || '12px', color: color || '#344054',
    whiteSpace: 'pre-wrap', margin: '4px 0'
  });
}
function action(t, fn) {
  return ui.Button({label: t, onClick: fn, style: {stretch: 'horizontal', margin: '4px 0'}});
}
function block(name, expanded) {
  var head = ui.Button({
    label: (expanded ? '▾  ' : '▸  ') + name,
    style: {stretch: 'horizontal', textAlign: 'left', fontWeight: 'bold',
      color: '#17446D', backgroundColor: '#EAF2F9', margin: '9px 0 2px'}
  });
  var body = ui.Panel({style: {shown: expanded, padding: '4px 7px'}});
  head.onClick(function() {
    expanded = !expanded;
    head.setLabel((expanded ? '▾  ' : '▸  ') + name);
    body.style().set('shown', expanded);
  });
  panel.add(head);
  panel.add(body);
  return body;
}

panel.add(label('Landsat 已有产品选景下载', '#15446F', '19px'));
panel.add(label('按接合表选择 Landsat 8/9 已有产品 · Collection 2 L2', '#667085', '11px'));

var sourceBody = block('01  导入已有产品', true);
// 与覆盖分析 GUI 的自动保存目录保持一致：可自动选择 GEE Table Asset。
var assetRootSelect = ui.Select({
  items:[{label:'正在读取 Assets 项目……',value:'__loading__'}],
  value:'__loading__',
  style:{stretch:'horizontal'}
});
var autoIndexSelect = ui.Select({
  items:[{label:'请先选择项目并刷新接合表',value:'__none__'}],
  value:'__none__',
  style:{stretch:'horizontal'}
});
var autoAssetStatus = label('可以自动发现 Landsat_Coverage_Indexes 中的接合表。','#667085','11px');
sourceBody.add(label('自动选择 GEE Assets 中的已有接合表'));
sourceBody.add(assetRootSelect);
sourceBody.add(action('刷新可用项目',refreshAssetRoots));
sourceBody.add(autoIndexSelect);
sourceBody.add(action('读取该项目已保存的接合表',refreshSavedIndexes));
sourceBody.add(action('加载选中的接合表',loadSelectedIndex));
sourceBody.add(autoAssetStatus);
sourceBody.add(label('也可以手动输入完整 Asset ID：'));

var assetText = ui.Textbox({placeholder: 'projects/你的项目/assets/landsat_index', value: CONFIG.defaultAsset,
  style: {stretch: 'horizontal'}});
sourceBody.add(label('接合表 GEE Asset 路径（需包含 PRODUCT_ID 字段）'));
sourceBody.add(assetText);
var filterText = ui.Textbox({placeholder: '可选：按产品ID关键词筛选，如 202507',
  style: {stretch: 'horizontal'}});
sourceBody.add(filterText);
sourceBody.add(action('加载接合表 / 应用筛选', loadAsset));
sourceBody.add(label('或者直接粘贴产品ID（逗号、空格、换行分隔）：'));
var manual = ui.Textbox({placeholder: 'LC08_L2SP_... , LC09_L2SP_...',
  style: {stretch: 'horizontal'}});
sourceBody.add(manual);
sourceBody.add(action('从粘贴的产品 ID 创建列表', loadManual));
sourceBody.add(label('提示：这里不是从SHP本地文件直接读取。先将接合表上传 GEE Assets，或将 PRODUCT_ID 列复制进上方输入框。', '#667085', '11px'));

var chooseBody = block('02  选择产品', true);
var status = label('尚未加载产品。');
chooseBody.add(status);
var pager = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});
var previousBtn = ui.Button('上一页', function() {openPage(page - 1);});
var nextBtn = ui.Button('下一页', function() {openPage(page + 1);});
var pageLabel = label('');
pager.add(previousBtn); pager.add(pageLabel); pager.add(nextBtn);
chooseBody.add(pager);
var productRows = ui.Panel();
chooseBody.add(productRows);
chooseBody.add(action('全选本页', function() { pageIDs.forEach(function(id) {selected[id] = true;}); refreshRows(); }));
chooseBody.add(action('取消本页', function() {pageIDs.forEach(function(id) {delete selected[id];}); refreshRows();}));
chooseBody.add(action('清空全部已选', function() {selected = {}; refreshRows();}));
var selectedSummary = label('已选 0 景', '#0B6682');
chooseBody.add(selectedSummary);

var exportBody = block('03  预览与导出设置', true);
var groupSelect = ui.Select({
  items: [
    {label: '7个地表反射率 SR 波段（DN）', value: 'SR'},
    {label: '7个 SR + QA_PIXEL/QA_RADSAT/SR_QA_AEROSOL', value: 'SR_QA'},
    {label: '全部 L2 波段（统一转为 Float32）', value: 'ALL'}
  ], value: 'SR', style: {stretch: 'horizontal'}
});
exportBody.add(label('波段组（不应用反射率比例因子）'));
exportBody.add(groupSelect);
var regionSelect = ui.Select({
  items: [
    {label: '完整场景足迹（推荐）', value: 'FULL'},
    {label: '与接合表全部要素空间并集的交集', value: 'INDEX'}
  ], value: 'FULL', style: {stretch: 'horizontal'}
});
exportBody.add(label('导出空间范围'));
exportBody.add(regionSelect);
var outputFolder = ui.Textbox({value: CONFIG.folder, style: {stretch: 'horizontal'}});
exportBody.add(label('Google Drive 目标文件夹'));
exportBody.add(outputFolder);
exportBody.add(action('地图预览所选第一景', previewFirst));
exportBody.add(action('创建所选产品的 GeoTIFF 导出任务', exportSelected));
exportBody.add(action('打印已选产品 ID（供 USGS 原版下载）', printSelected));
exportBody.add(label('单次最多创建 ' + CONFIG.maxTaskCount + ' 个 Tasks，任务生成后仍需到右侧 Tasks 点击 RUN。', '#667085', '11px'));

var infoBody = block('04  产品与下载说明', false);
infoBody.add(label('GEE：按既有产品 ID 定位并导出 SR / QA / 全部波段的 GeoTIFF。默认不做云掩膜、不合成、不应用比例因子；导出时可能发生栅格重采样，不能视为官方原版产品。'));
infoBody.add(label('USGS 官方整包（TAR、MTL等）：请使用 EarthExplorer 或 USGS M2M API，输入所选 LANDSAT_PRODUCT_ID 检索下载。'));
infoBody.add(ui.Label({value: '打开 USGS EarthExplorer',
  targetUrl: 'https://earthexplorer.usgs.gov/',
  style: {color: '#126F9D', textDecoration: 'underline'}}));

var selected = {};
var pageIDs = [];
var page = 0;
var totalCount = 0;
var mode = 'none';
var fc = null;
var manualIDs = [];
var loadVersion = 0;

function selectedIDs() {return Object.keys(selected).filter(function(k) {return selected[k];});}
function updateSummary() {selectedSummary.setValue('已选 ' + selectedIDs().length + ' 景');}

function refreshRows() {
  productRows.clear();
  pageIDs.forEach(function(id) {
    productRows.add(ui.Checkbox({
      label: id, value: !!selected[id],
      onChange: function(v) {if (v) selected[id] = true; else delete selected[id]; updateSummary();}
    }));
  });
  updateSummary();
}

// 自动发现当前账号能看到的 GEE Assets 根目录。
function refreshAssetRoots() {
  autoAssetStatus.setValue('正在读取 Assets 项目……');
  ee.data.getAssetRoots(function(roots, error) {
    if (error) {
      autoAssetStatus.setValue('读取项目失败：'+error);
      return;
    }
    var entries=(roots||[]).filter(function(x) {return x&&x.id;})
      .map(function(x) {return {label:x.id,value:x.id};});
    if (!entries.length) {
      assetRootSelect.items().reset([{label:'尚无可用项目',value:'__none__'}]);
      assetRootSelect.setValue('__none__',false);
      autoAssetStatus.setValue('尚无可用项目：请先在 GEE Assets 中 ADD A PROJECT。');
      return;
    }
    assetRootSelect.items().reset(entries);
    var preferred=entries.filter(function(x) {
      return x.value.indexOf('genuine-axle-465109-t9')>=0;
    })[0] || entries[0];
    assetRootSelect.setValue(preferred.value,false);
    autoAssetStatus.setValue('已找到 '+entries.length+' 个项目。点击「读取该项目已保存的接合表」。');
    refreshSavedIndexes();
  });
}
function refreshSavedIndexes() {
  var root=assetRootSelect.getValue();
  if(!root||root==='__none__'||root==='__loading__') {
    autoAssetStatus.setValue('请先选择有效项目。');
    return;
  }
  var folder=root.replace(/\/$/,'')+'/Landsat_Coverage_Indexes';
  autoAssetStatus.setValue('正在读取 '+folder+' ……');
  var allAssets=[];
  function fetchPage(token) {
    var opts={pageSize:100};
    if(token) opts.pageToken=token;
    ee.data.listAssets(folder,opts,function(res,error) {
      if(error){
        autoAssetStatus.setValue('无法读取目录：'+error+'。如果还没有保存接合表，请先在覆盖分析 GUI 中保存。');
        return;
      }
      var assets=(res&&res.assets)||[];
      allAssets=allAssets.concat(assets);
      if(res&&res.nextPageToken) {fetchPage(res.nextPageToken);return;}
      var list=allAssets.filter(function(a){
        return (a.type==='TABLE'||a.type==='FEATURE_COLLECTION')&&a.id;
      }).map(function(a){
        var name=a.id.split('/').pop();
        return {label:name,value:a.id};
      }).sort(function(a,b){return b.label.localeCompare(a.label);});
      if(!list.length){
        autoIndexSelect.items().reset([{label:'未找到接合表 Table Asset',value:'__none__'}]);
        autoIndexSelect.setValue('__none__',false);
        autoAssetStatus.setValue('该目录尚无可用 Table Asset。');
        return;
      }
      autoIndexSelect.items().reset(list);
      autoIndexSelect.setValue(list[0].value,false);
      autoAssetStatus.setValue('找到 '+list.length+' 份已保存接合表，可直接选择加载。');
    });
  }
  fetchPage(null);
}
function loadSelectedIndex(){
  var id=autoIndexSelect.getValue();
  if(!id||id==='__none__'){
    status.setValue('请先刷新并选择已保存的接合表。');
    return;
  }
  assetText.setValue(id,false);
  loadAsset();
}

function loadManual() {
  var raw = manual.getValue() || '';
  var list = raw.split(/[\s,;，；]+/).map(function(s) {return s.trim();})
    .filter(function(s) {return !!s;});
  var seen = {};
  manualIDs = list.filter(function(id) {
    if (seen[id]) return false;
    seen[id] = true; return true;
  });
  if (!manualIDs.length) {status.setValue('请先粘贴至少一个产品 ID。'); return;}
  mode = 'manual'; page = 0; selected = {};
  totalCount = manualIDs.length;
  openPage(0);
}

function loadAsset() {
  var path = (assetText.getValue() || '').trim();
  if (!path) {status.setValue('请先输入有效的接合表 Asset 路径。'); return;}
  var req = ++loadVersion;
  selected = {}; mode = 'asset'; page = 0;
  status.setValue('正在验证接合表与 PRODUCT_ID 字段……');
  fc = ee.FeatureCollection(path).filter(ee.Filter.notNull(['PRODUCT_ID']));
  var kw = (filterText.getValue() || '').trim();
  if (kw) fc = fc.filter(ee.Filter.stringContains('PRODUCT_ID', kw));
  // 去重：同一个产品可能在接合表中有多条记录
  fc = fc.distinct(['PRODUCT_ID']).sort('PRODUCT_ID');
  fc.size().evaluate(function(n, error) {
    if (req !== loadVersion) return;
    if (error) {status.setValue('Asset 加载失败：' + error); return;}
    totalCount = n || 0;
    if (!totalCount) {status.setValue('没有可用产品：请检查 Asset 路径、字段 PRODUCT_ID 和筛选关键词。'); return;}
    openPage(0);
  });
}

function openPage(n) {
  var maxPage = Math.max(0, Math.ceil(totalCount / CONFIG.pageSize) - 1);
  if (n < 0 || n > maxPage) return;
  page = n;
  pageLabel.setValue('第 ' + (page + 1) + '/' + (maxPage + 1) + ' 页');
  previousBtn.setDisabled(page === 0);
  nextBtn.setDisabled(page === maxPage);
  if (mode === 'manual') {
    pageIDs = manualIDs.slice(page * CONFIG.pageSize, (page + 1) * CONFIG.pageSize);
    status.setValue('已载入 ' + totalCount + ' 个产品 ID（粘贴模式）。');
    refreshRows(); return;
  }
  if (mode !== 'asset') return;
  var req = ++loadVersion;
  status.setValue('加载产品列表第 ' + (page + 1) + ' 页……');
  // 只传属性，避免把大量复杂场景几何下载到浏览器
  var props = ee.FeatureCollection(fc.toList(CONFIG.pageSize, page * CONFIG.pageSize)
    .map(function(f) {
      f = ee.Feature(f);
      return ee.Feature(null, {PRODUCT_ID: f.get('PRODUCT_ID')});
    }));
  props.aggregate_array('PRODUCT_ID').evaluate(function(arr, error) {
    if (req !== loadVersion) return;
    if (error) {status.setValue('加载列表失败：' + error); return;}
    pageIDs = arr || [];
    status.setValue('接合表中共 ' + totalCount + ' 个不同产品，请勾选需要下载的影像。');
    refreshRows();
  });
}

function imageByID(id) {
  return ee.Image(ALL.filter(ee.Filter.eq('LANDSAT_PRODUCT_ID', id)).first());
}
function ensureFound(id, onSuccess) {
  var col = ALL.filter(ee.Filter.eq('LANDSAT_PRODUCT_ID', id));
  col.size().evaluate(function(n, error) {
    if (error || !n) {status.setValue('未在 GEE L2 T1 中找到：' + id + (error ? '\n' + error : '')); return;}
    onSuccess(ee.Image(col.first()));
  });
}
function previewFirst() {
  var ids = selectedIDs();
  if (!ids.length) {status.setValue('请先勾选至少一景。'); return;}
  status.setValue('正在检索 ' + ids[0] + ' ……');
  ensureFound(ids[0], function(im) {
    map.layers().reset([]);
    var rgb = im.select(['SR_B4','SR_B3','SR_B2'])
      .multiply(0.0000275).add(-0.2);
    map.addLayer(rgb, {min:0.0, max:0.3}, ids[0]);
    map.centerObject(im, 8);
    status.setValue('地图已预览 ' + ids[0] + '（仅预览使用比例因子，导出不使用）。');
  });
}
function selectExportBands(im) {
  var group = groupSelect.getValue();
  if (group === 'ALL') return im.toFloat();
  var names = ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'];
  if (group === 'SR_QA') {
    names = names.concat(['QA_PIXEL','QA_RADSAT','SR_QA_AEROSOL']);
  }
  return im.select(names).toUint16();
}
function exportSelected() {
  var ids = selectedIDs();
  if (!ids.length) {status.setValue('请至少选择一景。'); return;}
  if (ids.length > CONFIG.maxTaskCount) {
    status.setValue('一次最多生成 ' + CONFIG.maxTaskCount + ' 个任务；当前选择 ' + ids.length + ' 景，请分批操作。');
    return;
  }
  status.setValue('正在创建任务……');
  var folder = (outputFolder.getValue() || CONFIG.folder).trim();
  var count = 0;
  ids.forEach(function(id) {
    var col = ALL.filter(ee.Filter.eq('LANDSAT_PRODUCT_ID', id));
    col.size().evaluate(function(n, error) {
      if (error || !n) {
        print('跳过未匹配产品：', id, error || 'GEE 无匹配');
        return;
      }
      var im = ee.Image(col.first());
      var region = im.geometry();
      if (regionSelect.getValue() === 'INDEX' && mode === 'asset' && fc) {
        // 接合表中的足迹往往与原完整场景相同；此处与足迹合并区相交
        var itemGeom = fc.filter(ee.Filter.eq('PRODUCT_ID',id)).geometry();
        region = region.intersection(itemGeom, ee.ErrorMargin(30));
      }
      var name = (id + '_' + groupSelect.getValue()).replace(/[^a-zA-Z0-9_-]/g, '_');
      Export.image.toDrive({
        image: selectExportBands(im),
        description: name,
        folder: folder,
        fileNamePrefix: name,
        region: region,
        scale: CONFIG.scale,
        maxPixels: 1e13,
        fileFormat: 'GeoTIFF',
        formatOptions: {cloudOptimized: true}
      });
      count++;
      status.setValue('已创建 ' + count + ' 个导出任务；请在右侧 Tasks 中逐个点击 RUN。');
    });
  });
}
function printSelected() {
  var ids = selectedIDs();
  if (!ids.length) {status.setValue('没有勾选产品。'); return;}
  print('已选产品 LANDSAT_PRODUCT_ID（' + ids.length + ' 景）:', ids);
  print('一行一个产品ID：\n' + ids.join('\n'));
  status.setValue('已将 ' + ids.length + ' 个产品ID打印到 Console，可复制用于 USGS EarthExplorer/M2M。');
}

refreshAssetRoots();
print('已有产品选景导出 GUI V1.1 已加载。');
print('说明：GeoTIFF 为 GEE 重导出，不等于 USGS 官方原版 TAR 包。');