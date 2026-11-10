/***************************************************************
 * 全国 Landsat 8/9 影像覆盖分析平台 V3.0
 * GEE Code Editor JavaScript
 * 全国省级默认西藏；省级/GAUL二级行政单位；季度/月度多选
 * 产品景数、覆盖面积/率、Path/Row、理论数据量、接合表、PNG
 * 数据：Landsat Collection 2 Tier 1 Level 2
 * 仅统计有效产品像元，不去除云/云影。
 * GAUL 2015 非中国现行权威行政边界，正式成果请替换。
 ***************************************************************/

// ============= 一、配置 =============
var DEFAULT_YEAR = '2025';
var DEFAULT_PROVINCE = 'Xizang';
var DEFAULT_SCALE = '2000'; // 统计尺度，米
var PNG_PIXELS = 1800;
var INDEX_PREVIEW_LIMIT = 300; // 地图矢量接合表预览景数上限

var provFC = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'China'));
var cityAll = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.eq('ADM0_NAME', 'China'));

// 前缀匹配解决“Xizang Zizhiqu”等拼写形式；未知名称保持原文。
var provinceNames = [
  ['Beijing','北京市'], ['Tianjin','天津市'], ['Hebei','河北省'],
  ['Shanxi','山西省'], ['Nei Mongol','内蒙古自治区'], ['Inner Mongolia','内蒙古自治区'],
  ['Liaoning','辽宁省'], ['Jilin','吉林省'], ['Heilongjiang','黑龙江省'],
  ['Shanghai','上海市'], ['Jiangsu','江苏省'], ['Zhejiang','浙江省'],
  ['Anhui','安徽省'], ['Fujian','福建省'], ['Jiangxi','江西省'],
  ['Shandong','山东省'], ['Henan','河南省'], ['Hubei','湖北省'],
  ['Hunan','湖南省'], ['Guangdong','广东省'], ['Guangxi','广西壮族自治区'],
  ['Hainan','海南省'], ['Chongqing','重庆市'], ['Sichuan','四川省'],
  ['Guizhou','贵州省'], ['Yunnan','云南省'], ['Xizang','西藏自治区'],
  ['Tibet','西藏自治区'], ['Shaanxi','陕西省'], ['Gansu','甘肃省'],
  ['Qinghai','青海省'], ['Ningxia','宁夏回族自治区'], ['Xinjiang','新疆维吾尔自治区'],
  ['Taiwan','台湾省'], ['Hong Kong','香港特别行政区'], ['Macao','澳门特别行政区'],
  ['Macau','澳门特别行政区']
];
var tibetCities = [
  ['Lhasa','拉萨市'], ['Lasa','拉萨市'], ['Lhoka','山南市'],
  ['Shannan','山南市'], ['Shigatse','日喀则市'], ['Xigaze','日喀则市'],
  ['Rikaze','日喀则市'], ['Qamdo','昌都市'], ['Chamdo','昌都市'],
  ['Changdu','昌都市'], ['Nyingchi','林芝市'], ['Linzhi','林芝市'],
  ['Nagqu','那曲市'], ['Naqu','那曲市'], ['Ngari','阿里地区'],
  ['Ali','阿里地区']
];
function displayName(raw, dictionary) {
  if (!raw) return '';
  var s = String(raw).toLowerCase();
  for (var i = 0; i < dictionary.length; i++) {
    if (s.indexOf(dictionary[i][0].toLowerCase()) === 0) return dictionary[i][1];
  }
  return raw;
}
function selectionItems(raws, dictionary) {
  return raws.map(function(n) {
    var cn = displayName(n, dictionary);
    return {label: cn === n ? n : cn + '  (' + n + ')', value: n};
  });
}

// ============= 二、界面通用组件 =============
ui.root.clear();
var side = ui.Panel({style:{width:'410px', padding:'12px', backgroundColor:'#FFFFFF'}});
var map = ui.Map();
map.setOptions('TERRAIN');
map.setCenter(88.8, 31.1, 6);
map.setControlVisibility({layerList:false, zoomControl:true, scaleControl:true, mapTypeControl:true, fullscreenControl:true});
ui.root.add(ui.SplitPanel({firstPanel:side, secondPanel:map, orientation:'horizontal', wipe:false}));

function txt(s, color, size) {
  return ui.Label(s, {color:color||'#334155', fontSize:size||'12px',
    margin:'4px 0', whiteSpace:'pre-wrap'});
}
function heading(s) {return ui.Label(s, {fontSize:'18px', fontWeight:'bold', color:'#17466E', margin:'5px 0'});}
function pick(items, value) {return ui.Select({items:items,value:value,style:{stretch:'horizontal',margin:'3px 0 6px'}});}
function button(s, f) {return ui.Button({label:s,onClick:f,style:{stretch:'horizontal',margin:'5px 0'}});}
function section(s, expanded) {
  var body = ui.Panel({style:{shown:expanded,padding:'5px 6px 9px 10px'}});
  var head = ui.Button({label:(expanded?'▾  ':'▸  ')+s,
    style:{stretch:'horizontal',textAlign:'left',backgroundColor:'#EDF4FA',
      color:'#17466E',fontWeight:'bold',margin:'7px 0 0',border:'0px'}});
  head.onClick(function() {expanded=!expanded;body.style().set('shown',expanded);
    head.setLabel((expanded?'▾  ':'▸  ')+s);});
  side.add(head);side.add(body);return body;
}
function caption(p, text, widget) {p.add(txt(text,'#475569'));p.add(widget);}
function addLink(p, text, url) {
  p.add(ui.Label({value:text,targetUrl:url,style:{color:'#146B9C',textDecoration:'underline',margin:'5px 0'}}));
}

side.add(heading('全国 Landsat 产品覆盖分析'));
side.add(txt('LANDSAT COVERAGE EXPLORER  |  V3.0','#64748B','10px'));
side.add(txt('默认西藏自治区；一级菜单可展开和收起。','#64748B','11px'));

// ============= 三、数据源与时间多选 =============
var pSource = section('01  数据源与时间',true);
var source = pick(['Landsat 8','Landsat 9','Landsat 8 + 9'],'Landsat 8');
caption(pSource,'产品来源',source);
var years=[];for(var yy=2026;yy>=2013;yy--)years.push(String(yy));
var year = pick(years,DEFAULT_YEAR);caption(pSource,'检索年份',year);
var mode = pick(['全年','季度多选','月份多选'],'季度多选');
caption(pSource,'检索时间尺度',mode);
var qPanel=ui.Panel();var mPanel=ui.Panel();
var qChecks=[];var mChecks=[];
for(var q=1;q<=4;q++) {
  var qc=ui.Checkbox('Q'+q+'（'+(3*q-2)+'—'+(3*q)+'月）',q===3);
  qChecks.push(qc);qPanel.add(qc);
}
for(var m=1;m<=12;m++) {
  var mc=ui.Checkbox(m+'月',m===7);
  mChecks.push(mc);mPanel.add(mc);
}
pSource.add(qPanel);pSource.add(mPanel);
var qRow=ui.Panel({layout:ui.Panel.Layout.flow('horizontal')});
qRow.add(button('全选季度',function(){qChecks.forEach(function(c){c.setValue(true,false);});}));
qRow.add(button('清空季度',function(){qChecks.forEach(function(c){c.setValue(false,false);});}));
pSource.add(qRow);
var mRow=ui.Panel({layout:ui.Panel.Layout.flow('horizontal')});
mRow.add(button('全选月份',function(){mChecks.forEach(function(c){c.setValue(true,false);});}));
mRow.add(button('清空月份',function(){mChecks.forEach(function(c){c.setValue(false,false);});}));
pSource.add(mRow);
function showMode(){var v=mode.getValue();qPanel.style().set('shown',v==='季度多选');
  mPanel.style().set('shown',v==='月份多选');qRow.style().set('shown',v==='季度多选');
  mRow.style().set('shown',v==='月份多选');}
mode.onChange(showMode);showMode();

// ============= 四、省级 / 地市选择 =============
var pArea=section('02  行政区范围',true);
var province=pick([{label:'西藏自治区',value:'Xizang Zizhiqu'}],'Xizang Zizhiqu');
caption(pArea,'省级行政区（默认西藏）',province);
var level=pick(['省级全域','下级行政单位（GAUL 2015）'],'省级全域');
caption(pArea,'统计范围',level);
var city=pick([{label:'请先加载行政区',value:'__loading__'}],'__loading__');
caption(pArea,'地市/第二级行政单位',city);
var areaMessage=txt('正在加载全国省级行政区……','#64748B','11px');pArea.add(areaMessage);
var provinceRequest=0;
function setSelect(sel,items,preferred) {
  if(!items.length)items=[{label:'无匹配结果',value:'__none__'}];
  sel.items().reset(items);
  var valid=items.some(function(it){return it.value===preferred;});
  sel.setValue(valid?preferred:items[0].value,false);
}
function updateCity() {
  var seq=++provinceRequest;
  var p=province.getValue();
  if(!p||p==='__none__')return;
  var selected=cityAll.filter(ee.Filter.eq('ADM1_NAME',p));
  areaMessage.setValue('正在加载该省第二级行政单位……');
  selected.aggregate_array('ADM2_NAME').distinct().sort().evaluate(function(arr,err){
    if(seq!==provinceRequest)return;
    if(err||!arr||!arr.length){setSelect(city,[],null);
      areaMessage.setValue('没有找到下级边界：'+(err||'数据为空'));return;}
    var dic=String(p).toLowerCase().indexOf('xizang')>=0?tibetCities:[];
    setSelect(city,selectionItems(arr,dic),null);
    areaMessage.setValue('共加载 '+arr.length+' 个 GAUL 二级单位。该数据为2015年历史行政区，部分单位并非现行地级市。');
  });
}
province.onChange(updateCity);
function showLevel(){city.style().set('shown',level.getValue()!=='省级全域');}
level.onChange(showLevel);showLevel();
provFC.aggregate_array('ADM1_NAME').distinct().sort().evaluate(function(arr,err){
  if(err||!arr||!arr.length){areaMessage.setValue('省级边界加载失败：'+err);return;}
  var chosen=arr.filter(function(x){return x.toLowerCase().indexOf(DEFAULT_PROVINCE.toLowerCase())>=0;})[0]||arr[0];
  setSelect(province,selectionItems(arr,provinceNames),chosen);
  updateCity();
});

// ============= 五、统计选项 =============
var pOptions=section('03  统计与显示设置',false);
var statScale=pick(['5000','2000','1000'],DEFAULT_SCALE);
caption(pOptions,'覆盖率计算尺度（米）',statScale);
var estimateBands=pick(['7个 SR 波段','7个 SR + 2个 QA 波段'],'7个 SR 波段');
caption(pOptions,'未压缩数据量估算口径',estimateBands);
pOptions.add(txt('假定每景约170×183 km、30 m像元、每波段16 bit；是理论整景未压缩量，不代表实际产品ZIP大小。','#64748B','11px'));

// ============= 六、结果与图层 =============
var pRun=section('04  检索与覆盖率结果',true);
var runStatus=txt('选择行政区和季度/月度后点击运行。');
var resultPanel=ui.Panel();
pRun.add(button('▶ 运行多时段分析',runAll));pRun.add(runStatus);pRun.add(resultPanel);
var pLayers=section('05  图层管理',false);
var layersPanel=ui.Panel();pLayers.add(layersPanel);
pLayers.add(button('显示所选时段矢量接合表（最多300景）',showIndexPreview));
var pFiles=section('06  PNG、接合表与清单',false);
var periodSelect=pick([{label:'请先运行分析',value:'__none__'}],'__none__');
caption(pFiles,'选择要下载的时段',periodSelect);
var linkPanel=ui.Panel();
pFiles.add(button('生成所选时段 PNG 链接',makePNG));
pFiles.add(button('生成所选时段接合表 GeoJSON',makeGeoJSON));
pFiles.add(button('生成所选时段产品清单 CSV',makeCSV));
pFiles.add(button('导出完整 SHP（到 Google Drive / Tasks）',makeSHP));
pFiles.add(txt('SHP 包含 .shp / .shx / .dbf / .prj 等配套文件。请从 Drive 下载同名前缀的全部文件，并在本地压缩为 ZIP；单独的 .cpg 不是矢量接合表。','#64748B','11px'));
pFiles.add(txt('GEE Assets 直接保存（推荐用于后续选景下载）','#475569'));
var assetIdBox = ui.Textbox({
  placeholder:'projects/你的GEE项目/assets/Landsat_Index_2025_Q3',
  style:{stretch:'horizontal'}
});
pFiles.add(assetIdBox);
pFiles.add(button('保存当前接合表到 GEE Assets（Tasks）',makeAsset));
pFiles.add(linkPanel);
pFiles.add(txt('GeoJSON 是单文件完整矢量格式；SHP 是多文件格式。多时段 PNG 请逐个选择生成。','#64748B','11px'));

// ============= 七、影像处理 =============
function getArea(){
  var p=province.getValue();
  if(!p||p==='__none__')return null;
  var fc;
  if(level.getValue()==='省级全域')fc=provFC.filter(ee.Filter.eq('ADM1_NAME',p));
  else {if(city.getValue()==='__none__'||city.getValue()==='__loading__')return null;
    fc=cityAll.filter(ee.Filter.eq('ADM1_NAME',p))
      .filter(ee.Filter.eq('ADM2_NAME',city.getValue()));}
  var name=displayName(p,provinceNames);
  if(level.getValue()!=='省级全域')name+='_'+displayName(city.getValue(),
    p.toLowerCase().indexOf('xizang')>=0?tibetCities:[]);
  return {fc:fc,name:name};
}
function periods(){
  var y=parseInt(year.getValue(),10),result=[];
  var ty=mode.getValue();
  if(ty==='全年')return [{key:y+'_YEAR',label:y+' 全年',m1:1,m2:13}];
  if(ty==='季度多选'){
    qChecks.forEach(function(check,i){if(check.getValue())result.push({
      key:y+'_Q'+(i+1),label:y+' 第'+(i+1)+'季度',m1:i*3+1,m2:i*3+4
    });});
  }else{
    mChecks.forEach(function(check,i){if(check.getValue())result.push({
      key:y+'_M'+('0'+(i+1)).slice(-2),label:y+'年'+(i+1)+'月',m1:i+1,m2:i+2
    });});
  }
  return result;
}
function collection(){
  var s=source.getValue();
  var l8=ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
  var l9=ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
  if(s==='Landsat 8')return l8;
  if(s==='Landsat 9')return l9;
  return l8.merge(l9);
}
function validMask(img){
  var qa=img.select('QA_PIXEL');
  // 位0为Fill，云、云影、雪仍视为产品覆盖。
  return qa.bitwiseAnd(1).eq(0).updateMask(qa.mask())
    .unmask(0,false).rename('coverage').toByte();
}
function getIndex(col){
  var ids=col.toList(col.size());
  return ee.FeatureCollection(ids.map(function(x){
    var im=ee.Image(x);
    return ee.Feature(im.geometry(),{
      PRODUCT_ID:im.get('LANDSAT_PRODUCT_ID'),
      SCENE_ID:im.get('LANDSAT_SCENE_ID'),
      DATE:ee.Date(im.get('system:time_start')).format('YYYY-MM-dd'),
      SATELLITE:im.get('SPACECRAFT_ID'),
      WRS_PATH:im.get('WRS_PATH'),WRS_ROW:im.get('WRS_ROW'),
      CLOUD_PCT:im.get('CLOUD_COVER')
    });
  }));
}
function computePeriod(base,roi,p,scale){
  var y=parseInt(year.getValue(),10);
  var st=ee.Date.fromYMD(y,p.m1,1);
  var en=p.m2===13?ee.Date.fromYMD(y+1,1,1):ee.Date.fromYMD(y,p.m2,1);
  var col=base.filterBounds(roi).filterDate(st,en);
  // 零影像确保空集合不报错。
  var zeros=ee.Image.constant(0).rename('coverage').toByte();
  var coverage=col.map(validMask).merge(ee.ImageCollection([zeros]))
    .max().clip(roi);
  var pixel=ee.Image.pixelArea();
  var areas=ee.Image.cat([
    pixel.rename('total'),pixel.multiply(coverage).rename('covered')
  ]).reduceRegion({reducer:ee.Reducer.sum(),geometry:roi,
    crs:'EPSG:4326',scale:scale,tileScale:16,maxPixels:1e13});
  return {
    col:col,cover:coverage,
    summary:ee.Dictionary({
      scenes:col.size(),
      frames:col.distinct(['WRS_PATH','WRS_ROW']).size(),
      total:areas.get('total'),
      covered:areas.get('covered')
    })
  };
}

// ============= 八、结果顺序执行，避免并发聚合 =============
var records={}; var activeRun=0;
function resetLayers(){map.layers().reset([]);layersPanel.clear();}
function addManaged(image,vis,name,shown){
  map.addLayer(image,vis,name,shown);
  var layer=map.layers().get(map.layers().length()-1);
  layersPanel.add(ui.Checkbox({label:name,value:shown,onChange:function(v){layer.setShown(v);}}));
}
function runAll(){
  var area=getArea(),ps=periods();
  if(!area){runStatus.setValue('当前行政区没有正确加载，请检查省级/地市选择。');return;}
  if(!ps.length){runStatus.setValue('请至少勾选一个季度或月份。');return;}
  var run=++activeRun;
  var roi=area.fc.geometry(),base=collection(),scale=parseInt(statScale.getValue(),10);
  var bandN=estimateBands.getValue().indexOf('2个 QA')>=0?9:7;
  records={};resultPanel.clear();linkPanel.clear();resetLayers();
  setSelect(periodSelect,[{label:'分析运行中',value:'__none__'}],'__none__');
  runStatus.setValue('开始分析 '+ps.length+' 个时段，逐项计算以降低并发压力……');
  map.centerObject(area.fc);
  addManaged(area.fc.style({color:'F18B32',fillColor:'00000000',width:2}),{},'研究区：'+area.name,true);
  var output=[];
  var columns=['时段','景数','分幅','覆盖率','覆盖面积km²','理论GB'];
  function next(i){
    if(run!==activeRun)return;
    if(i>=ps.length){
      runStatus.setValue('全部完成：'+ps.length+' 个时段。可展开图层管理、成图与下载。');
      resultPanel.add(txt('以下结果按所选时段逐项计算；面积为近似统计。','#64748B','11px'));
      // 属性均在客户端构建，不触发新的覆盖面积计算。
      var rows=output.map(function(r){
        return ee.Feature(null,{period:r.key,scenes:r.scenes,frames:r.frames,
          coverage_pct:r.pct,covered_km2:r.km2,estimated_GB:r.gb});
      });
      if(rows.length){
        var chart=ui.Chart.feature.byFeature({
          features:ee.FeatureCollection(rows),
          xProperty:'period',yProperties:['coverage_pct']
        }).setChartType('ColumnChart').setOptions({
          title:'所选时段产品覆盖率',legend:{position:'none'},
          hAxis:{title:'时段',slantedText:true},
          vAxis:{title:'覆盖率(%)',viewWindow:{min:0,max:100}},
          colors:['#218C9A']
        });
        resultPanel.add(chart);
      }
      return;
    }
    var p=ps[i];runStatus.setValue('正在计算 '+p.label+'（'+(i+1)+' / '+ps.length+'）……');
    var analysis=computePeriod(base,roi,p,scale);
    analysis.summary.evaluate(function(v,error){
      if(run!==activeRun)return;
      if(error||!v||!v.total){
        resultPanel.add(txt(p.label+'：计算失败。'+(error||'结果为空')+'；可增大统计尺度。','#B45309'));
        next(i+1);return;
      }
      var scenes=Number(v.scenes)||0,frames=Number(v.frames)||0;
      var km2=(Number(v.covered)||0)/1e6;
      var pct=100*(Number(v.covered)||0)/Number(v.total);
      var gb=scenes*170000*183000/(30*30)*bandN*2/1e9;
      var entry={key:p.key,label:p.label,scenes:scenes,frames:frames,
        pct:pct,km2:km2,gb:gb};
      output.push(entry);
      records[p.key]={analysis:analysis,period:p,area:area,roi:roi,run:run,entry:entry};
      resultPanel.add(txt(p.label+'：'+scenes+' 景｜'+frames+' 分幅｜覆盖率 '+
        pct.toFixed(2)+'%｜覆盖面积 '+km2.toFixed(1)+' km²｜估算 '+gb.toFixed(1)+' GB',
        '#1F4D72','12px'));
      addManaged(analysis.cover.selfMask(),{palette:['267FBD']},p.label+' 产品覆盖',i===0);
      var entries=Object.keys(records).map(function(k){return {label:records[k].period.label,value:k};});
      setSelect(periodSelect,entries,p.key);
      // map layers order: ensure boundary remains visible by adding another outline on top
      if(i===0)addManaged(area.fc.style({color:'F18B32',fillColor:'00000000',width:2}),{},'研究区描边',true);
      next(i+1);
    });
  }
  area.fc.size().evaluate(function(n,e){
    if(run!==activeRun)return;
    if(e||!n){runStatus.setValue('研究区为空或加载失败：'+(e||'0个要素'));return;}
    next(0);
  });
}

// 根据当前选择的时段显示接合表矢量边界（限制前300景做地图预览）。
function showIndexPreview(){
  var r=records[periodSelect.getValue()];
  if(!r){runStatus.setValue('请先运行分析，并在下载菜单选择一个时段。');return;}
  var subset=r.analysis.col.limit(INDEX_PREVIEW_LIMIT);
  var preview=getIndex(subset).style({color:'EA7A22',fillColor:'00000000',width:1});
  addManaged(preview,{},r.period.label+' 接合表足迹（最多300景）',true);
  runStatus.setValue('已添加场景接合表预览；完整矢量可在06下载或导出。');
}

// ============= 九、下载与接合表 =============
function chosen(){
  linkPanel.clear();
  var r=records[periodSelect.getValue()];
  if(!r){linkPanel.add(txt('请先运行分析并选择时段。'));return null;}
  return r;
}
function makePNG(){
  var r=chosen();if(!r)return;
  linkPanel.add(txt('正在生成 PNG 下载链接……'));
  var bg=ee.Image.constant(0).clip(r.roi).visualize({palette:['EDF2F7']});
  var covered=r.analysis.cover.selfMask().visualize({palette:['2686BD']});
  var border=ee.Image().byte().paint(r.area.fc,1,2).visualize({palette:['F18B32']});
  var img=ee.ImageCollection([bg,covered,border]).mosaic();
  img.getThumbURL({region:r.roi.bounds(),dimensions:PNG_PIXELS,format:'png'},function(url,error){
    if(r.run!==activeRun)return;
    linkPanel.clear();
    if(error){linkPanel.add(txt('PNG生成失败：'+error));return;}
    addLink(linkPanel,'打开并下载 '+r.period.key+' PNG',url);
  });
}
function makeGeoJSON(){
  var r=chosen();if(!r)return;
  linkPanel.add(txt('正在生成逐景接合表 GeoJSON 下载链接……'));
  getIndex(r.analysis.col).getDownloadURL('geojson',null,r.period.key+'_scene_index',function(url,error){
    if(r.run!==activeRun)return;
    linkPanel.clear();
    if(error){linkPanel.add(txt('生成失败：'+error+'；可使用SHP任务导出。'));return;}
    addLink(linkPanel,'下载 '+r.period.key+' GeoJSON',url);
  });
}
function makeCSV(){
  var r=chosen();if(!r)return;
  linkPanel.add(txt('正在生成产品清单 CSV 链接……'));
  var fields=['PRODUCT_ID','SCENE_ID','DATE','SATELLITE','WRS_PATH','WRS_ROW','CLOUD_PCT'];
  var attrs=getIndex(r.analysis.col).map(function(f){
    return ee.Feature(null,f.toDictionary(fields));
  });
  attrs.getDownloadURL('csv',fields,r.period.key+'_products',function(url,error){
    if(r.run!==activeRun)return;
    linkPanel.clear();
    if(error){linkPanel.add(txt('CSV生成失败：'+error));return;}
    addLink(linkPanel,'下载 '+r.period.key+' CSV',url);
  });
}
function makeSHP(){
  var r=chosen();if(!r)return;
  var prefix='Landsat_Index_'+r.period.key;
  // Google Drive 任务会输出一组同名前缀的 SHP 组成文件。
  Export.table.toDrive({
    collection:getIndex(r.analysis.col),
    description:prefix,
    folder:'GEE_Landsat_Index',
    fileNamePrefix:prefix,
    fileFormat:'SHP',
    selectors:['PRODUCT_ID','SCENE_ID','DATE','SATELLITE','WRS_PATH','WRS_ROW','CLOUD_PCT']
  });
  linkPanel.add(txt('已在 Tasks 创建 SHP 导出任务。请在 GEE Tasks 中点击 RUN；任务完成后到 Google Drive 的 GEE_Landsat_Index 文件夹中下载同名前缀的 .shp、.shx、.dbf、.prj（以及可能的 .cpg），本地一起压缩为 ZIP。只下载 .cpg 不可使用。','#0E766E'));
}
function makeAsset(){
  var r=chosen();if(!r)return;
  var assetId=(assetIdBox.getValue()||'').trim();
  if(!/^projects\\/[^/]+\\/assets\\/[^/]+/.test(assetId)){
    linkPanel.add(txt('请填写完整 GEE Asset ID，例如 projects/你的项目/assets/Landsat_Index_2025_Q3。','#B45309'));
    return;
  }
  var prefix='Index_Asset_'+r.period.key;
  Export.table.toAsset({
    collection:getIndex(r.analysis.col),
    description:prefix,
    assetId:assetId
  });
  linkPanel.add(txt('GEE Asset 任务已创建。请到 Tasks 点击 RUN；完成后复制 Asset ID 至已有产品选景 GUI。','#0E766E'));
}
print('全国 Landsat 覆盖分析 V3.0 已初始化。');
print('提示：GAUL 2015 为历史行政区数据；数据体量为理论估算；多选结果逐项计算。');