/**
 * NetLab Explorer — 课程目录类型
 * 对应 docs/m2a-implementation-plan.md §4.8：导航（分组 / 课程 / 英文副标题 / 顺序）
 * 是**站点的组织元数据**，不属于演示数据本体（Demo 不持有标题顺序与分组）。
 */

/** 课程分组（对应侧栏分组标题与顶栏分类导航）。 */
export interface CatalogGroup {
  /** 如 'network' */
  id: string;
  name: string;
  /** 英文副标题，如 'NETWORK PROTOCOLS' */
  en: string;
  color: string;
  dark?: string;
  /** 该组要回答的问题（右侧「整理范围」引用） */
  question: string;
}

/** 一门课的目录条目：把 demo、knowledge、分组串起来。 */
export interface CourseEntry {
  /** → content/demos/*.json 的 Demo.id */
  demoId: string;
  /** → content/knowledge/*.json 的 KnowledgePoint.id */
  knowledgeId: string;
  /** → CatalogGroup.id */
  groupId: string;
  /**
   * 视图 id / URL hash（如 'tcp'）。
   * 与 demoId 分开：hash 是既有的深链与进度键契约，demoId 是数据主键。
   */
  hash: string;
  /** 课程英文副标题（导航第二行） */
  titleEn: string;
  /** 组内顺序，1 起 */
  order: number;
}

export interface Catalog {
  groups: CatalogGroup[];
  courses: CourseEntry[];
}
