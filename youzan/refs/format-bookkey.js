const result1 = JSON.parse(
  '[{"goods_id":4082141737,"num":1,"sku_id":14864732375,"price":39900,"extra":{},"dcPs":"","biz_trace_point_ext":"{\\"atr_uuid\\":\\"\\",\\"yzk_ex\\":\\"\\",\\"page_type\\":\\"\\",\\"tui_platform\\":\\"\\",\\"tui_click\\":\\"\\",\\"wecom_uuid\\":\\"\\",\\"from_source\\":\\"\\",\\"pv_id\\":\\"/v2/showcase/homepage~085945c9-cdce-430c-9eae-22fd427310d2\\",\\"st\\":\\"js\\",\\"sv\\":\\"1.1.49\\",\\"yai\\":\\"wsc_c\\",\\"uuid\\":\\"6a3b3b3f-3607-7659-bed3-08e4b81bb087\\",\\"userId\\":11803567576,\\"platform\\":\\"web\\",\\"alias\\":\\"2oknqq9yxogu5tq\\"}","qr":"","tpps":"","fcode":"","isSevenDayUnconditionalReturn":true}]'
);

console.log('result1:', result1);

const result2 = JSON.parse(result1[0].biz_trace_point_ext);

console.log('result2:', result2);

const result3 = JSON.parse(
  '{"kdt_id":118622541,"store_id":0,"store_name":"","postage":0,"activity_alias":"","activity_id":0,"activity_type":0,"use_wxpay":0,"from":"","bosWorkFlow":false,"isFromItemDetail":false,"source":"goods_detail"}'
);

console.log('result3:', result3);
