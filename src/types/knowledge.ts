/**
 * NetLab Explorer — 知识点类型
 * 对应 docs/data-model-design.md §4（KnowledgePoint / PacketStructure / ContentStatus / ContentState）。
 * 关系唯一属主在 knowledge 一侧：sourceRefs / demoRefs / relatedKnowledge 只在这里登记，
 * 反向索引由构建期校验器生成，不落盘（避免双向同步漂移）。
 */
import type { SourceRef } from './source.ts';

/** 九大知识模块，对应 docs/network-knowledge-map.md。 */
export type ModuleId = 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08' | 'M09';

/** 发布状态（轨道一）。与来源授权状态 licenseStatus 相互独立。 */
export type ContentStatus = 'draft' | 'review' | 'published';

/** 版权状态。third-party / permission-required 不得发布（发布门禁 P3）。 */
export type ContentState =
  | 'original'
  | 'adapted'
  | 'third-party'
  | 'permission-required'
  | 'license-verified';

export type KnowledgeLevel = 'basic' | 'intermediate' | 'advanced';

export type AccessLevel = 'free' | 'pro';

/** 报文/帧结构（可选）。 */
export interface PacketStructure {
  /** 文字描述，如 'TCP 首部 20~60 字节…' */
  description: string;
  /** 字段表 */
  layout?: { field: string; bits: string; note?: string }[];
}

/**
 * 知识点主体。
 * 六问正文对应计划书 §6.1 基础内容模板：是什么/为什么/原理/实际场景/常见误区。
 */
export interface KnowledgePoint {
  /** 'NET-MM-NN'，全库唯一（同 knowledge 命名空间内） */
  id: string;
  title: string;
  categoryId: ModuleId;
  level: KnowledgeLevel;

  /* 六问正文 */
  /** 一句话介绍 */
  summary: string;
  /** 是什么 */
  what: string;
  /** 为什么需要它 / 解决了什么问题 */
  why: string;
  /** 工作原理（原创表述） */
  principle: string;
  /** 实际网络中如何使用 */
  practicalScenario: string;
  /** 常见错误理解，至少 1 条 */
  commonProblems: string[];

  packetStructure?: PacketStructure;

  /* 多对多关联 */
  /** 关联知识点 id[]；双向关系只登记一次，校验器检查互指一致性（X3） */
  relatedKnowledge: string[];
  /** → 来源台账（source.ts 的 SourceRef，多对多连接记录） */
  sourceRefs: SourceRef[];
  /** → 演示数据 id[]；一个知识点可挂多个演示，一个演示可服务多个知识点 */
  demoRefs: string[];

  /** 交互实验 id（实验阶段未启动，仅占位） */
  labId?: string;

  /* 管理字段 */
  /** 商业化预留（Open Core，计划书 §8） */
  accessLevel: AccessLevel;
  /** 发布状态（轨道一） */
  status: ContentStatus;
  /** 版权状态 */
  contentState: ContentState;
  createdAt: string;
  updatedAt: string;
}
