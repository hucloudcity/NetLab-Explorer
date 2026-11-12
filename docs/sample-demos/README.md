# 样例数据说明（docs/sample-demos/）

三份样例用于**验证数据模型**（第三阶段），不是可直接运行的页面数据；落地时由迁移管线转换为引擎消费格式。

| 文件 | 验证重点 |
|---|---|
| `tcp-handshake.json` | 顺序事件链（3 步串行）、TCP 报文字段（seq/ack/flags）、`tcp-state` StateDelta×4、故障场景（drop + process 重传） |
| `arp-resolution.json` | 广播域推导接收者（`to: broadcast`）、多设备接收但单一响应者（e-ignore-c vs e-reply）、`arp-cache` / `mac-table` StateDelta、跨网段解析网关 MAC |
| `dns-resolution.json` | 5 设备多跳链、递归（RD=1）与迭代（RD=0）的事件表达、通用状态表 `dns-cache`、缓存命中对比场景（initialState 预置缓存） |

## 字段约定速查

- `event.kind`：`unicast / broadcast / multicast / process / drop`。
- `event.to`：联合类型 `device | broadcast(domain) | multicast(domain+roleFilter)`；接收者集合由拓扑广播域**推导**，不在事件里枚举 `targets`。
- `event.dependsOn`：同步骤内依赖图；引擎按拓扑分层算波次，同波并行、波间串行。
- `stateDeltas[].afterEvent`：事件完成即应用；缺省为步骤全部事件完成后。
- `traceRow`：数据包流表格行，与现站七列表一一对应；`null` 表示该步无表格行。
- `knowledgeRefs-`：占位说明字段，提醒反向关系登记在 knowledge 一侧（校验器会拒绝未知字段名，此字段仅文档用途，落地前删除）。

## 样例未覆盖（由后续真实数据补充）

- `multicast` 角色过滤样例（OSPF Hello，模块 06 建设时补）。
- 并行事件的实际动画（DNS 缓存命中分支已含同波三事件，视觉并行在引擎实现时再验）。
