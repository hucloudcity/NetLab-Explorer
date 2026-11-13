/**
 * NetLab Explorer — 来源台账类型
 * 对应 docs/data-model-design.md §3（Source / SourceRef / LicenseStatus）。
 * 设计要点：来源是独立资源；授权状态（licenseStatus）与知识点的发布状态（status）是两条轨道，分开管理。
 */

/** 来源授权状态 —— 8 种取值，见 data-model-design.md §3。 */
export type LicenseStatus =
  | 'public-standard'        // 公开标准（RFC）
  | 'paid-standard'          // 付费标准（IEEE）：只引用编号/标题，不引正文
  | 'copyright-textbook'     // 教材：原创表述，不复制正文/插图/习题
  | 'vendor-copyright'       // 厂商文档：不搬运受版权内容，仅作工程核对
  | 'open-source-permissive' // BSD/MIT/Apache 等
  | 'open-source-copyleft'   // GPL 类：只使用不合并
  | 'per-file-review'        // 逐文件授权未核实（如 Wireshark 样本抓包）
  | 'pending';               // 尚未核查

export type SourceType = 'textbook' | 'rfc' | 'ieee' | 'vendor' | 'lab' | 'tool';

/** 一条来源（台账主体，sources.json 的一条记录）。 */
export interface Source {
  /** 如 'rfc-9293'、'kr-9e-textbook'、'ieee-802-1Q' */
  sourceId: string;
  type: SourceType;
  /** 如 'Transmission Control Protocol' */
  name: string;
  /**
   * 来源卡片上的一句说明（「该来源在教学里起什么作用」）。
   * 缺省则不渲染说明行；与 `licenseNote`（授权约束）语义不同，不可互换。
   */
  description?: string;
  /** 如 'W. Eddy (Ed.)' 或 'Kurose & Ross' */
  author: string;
  /** 如 'RFC 9293' / '9th Edition' / 'IEEE 802.1Q-2022' */
  version?: string;
  /** 官方地址（禁止第三方镜像，ADR-003） */
  url: string;
  licenseStatus: LicenseStatus;
  /** 如 '付费标准：仅可指认编号，不得引条款正文' */
  licenseNote?: string;
  /** ISO 日期，如 '2026-11-12' */
  addedAt: string;
}

/**
 * knowledge 对某条来源的一次「引用」（多对多连接记录，属主在 knowledge 一侧）。
 * 目的与章节因知识点而异，所以单独建模，不塞进 Source 本体。
 */
export interface SourceRef {
  /** 必须存在于 sources.json */
  sourceId: string;
  /** 该来源用于核对什么，如 '核对 SYN/SYN-ACK 标志位与状态迁移' */
  purpose: string;
  /** 具体章节/条款，如 ['3.5.1']；禁止凭空填写（计划书 §5）。特殊来源可为空，但需 verificationNote 说明 */
  sections: string[];
  /** 最后核对日期（ISO），必填 */
  checkedAt: string;
  /** 核对方式说明，如 '对照 Wireshark 抓包验证' */
  verificationNote?: string;
}
