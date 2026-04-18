import type OpenAI from "openai"

type Tool = OpenAI.ChatCompletionTool

export const NL_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "view_schedule",
      description: "查看指定员工或班组在某段日期范围内的排班信息",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "员工姓名（可选）" },
          teamName: { type: "string", description: "班组名称（可选）" },
          from: { type: "string", description: "起始日期 YYYY-MM-DD" },
          to: { type: "string", description: "结束日期 YYYY-MM-DD" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_leave",
      description: "为员工提交请假申请",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "请假员工姓名" },
          startDate: { type: "string", description: "请假开始日期 YYYY-MM-DD" },
          endDate: { type: "string", description: "请假结束日期 YYYY-MM-DD" },
          type: {
            type: "string",
            enum: [
              "ANNUAL",
              "CHILD_CARE",
              "SICK",
              "PERSONAL",
              "MARRIAGE",
              "NURSING",
              "PATERNITY",
              "BEREAVEMENT",
              "annual",
              "sick",
              "personal",
              "other",
            ],
            description:
              "请假类型：ANNUAL年假 CHILD_CARE育儿假 SICK病假 PERSONAL事假 MARRIAGE婚假 NURSING护理假 PATERNITY陪产假 BEREAVEMENT丧假；也可用旧别名 annual/sick/personal/other",
          },
          hours: { type: "string", description: "请假小时数，默认 8" },
          reason: { type: "string", description: "请假原因" },
        },
        required: ["employeeName", "startDate", "endDate", "type", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_leave",
      description:
        "审批（批准或驳回）指定员工的请假申请。若该员工有多条 pending，请一并传 startDate 精确定位；否则系统会返回需澄清的提示。",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "请假员工姓名" },
          action: { type: "string", enum: ["approve", "reject"], description: "approve=批准，reject=驳回" },
          startDate: { type: "string", description: "请假开始日期 YYYY-MM-DD（多条 pending 时必填）" },
          approverId: { type: "string", description: "审批人标识，可省略，默认 manager" },
        },
        required: ["employeeName", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule",
      description: "为员工新建排班",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "员工姓名" },
          shiftName: { type: "string", description: "班次名称（如：早班、中班、晚班）" },
          date: { type: "string", description: "排班日期 YYYY-MM-DD" },
        },
        required: ["employeeName", "shiftName", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_attendance",
      description: "查看员工或班组的出勤统计信息",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "员工姓名（可选）" },
          teamName: { type: "string", description: "班组名称（可选）" },
          month: { type: "string", description: "月份 YYYY-MM" },
        },
        required: ["month"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_schedule",
      description: "导出排班数据为 Excel 文件",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "起始日期 YYYY-MM-DD" },
          to: { type: "string", description: "结束日期 YYYY-MM-DD" },
          teamName: { type: "string", description: "班组名称（可选，不传则导出全部）" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_leave_gaps",
      description: "查看某段日期范围内因请假导致的人员缺口预警",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "起始日期 YYYY-MM-DD" },
          to: { type: "string", description: "结束日期 YYYY-MM-DD" },
          teamName: { type: "string", description: "班组名称（可选）" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_attendance_alerts",
      description: "查看出勤异常预警，如迟到、早退、缺勤过多的员工",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "月份 YYYY-MM" },
          teamName: { type: "string", description: "班组名称（可选）" },
        },
        required: ["month"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_leave_panel",
      description:
        "班长视角：查看某员工的假期面板，返回消耗型假期（年假/婚假/育儿假）剩余额度、上限型假期（丧假≤7天/陪产假≤10天等）已用与剩余、本年度已请假历史。",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "员工姓名" },
          year: { type: "string", description: "年份 YYYY，默认当年" },
        },
        required: ["employeeName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_team_day_leaves",
      description:
        "班长视角：查看某班组在某日的请假情况（pending + approved），以及当天班次覆盖风险评估（ok/tight/shortage）。",
      parameters: {
        type: "object",
        properties: {
          teamName: { type: "string", description: "班组名称" },
          date: { type: "string", description: "日期 YYYY-MM-DD" },
        },
        required: ["teamName", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_pending_leaves",
      description: "总经理视角：查看待审批请假工单队列（status=pending），按创建时间倒序。",
      parameters: {
        type: "object",
        properties: {
          teamName: { type: "string", description: "班组名称（可选）" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_team_day_attendance",
      description:
        "总经理视角：查看某班组某日的出勤情况（基于排班默认出勤；已批准请假覆盖为 leave）。",
      parameters: {
        type: "object",
        properties: {
          teamName: { type: "string", description: "班组名称" },
          date: { type: "string", description: "日期 YYYY-MM-DD" },
        },
        required: ["teamName", "date"],
      },
    },
  },
]

export const SYSTEM_PROMPT = `你是"排班考勤助手"，面向两类用户：班长（受理请假）和总经理（最终审批）。

系统核心假设：
- 目前未对接打卡系统，所有人默认出勤；只有"请假"会覆盖出勤状态
- 假期分两类：
  * 消耗型（年假、婚假、育儿假）：按 LeaveBalanceAccount 余额扣减，超额不可受理
  * 上限型（丧假≤7天、陪产假≤10天、护理假、病假、事假）：按年度累计不超过 policy.maxDays 校验
- pending 代表"班长已受理，等待总经理审批"
- 新建请假时系统会自动做额度校验，审批通过时系统会自动扣减余额并把对应排班改为 leave

你的能力：
1. view_schedule / create_schedule / export_schedule：排班相关
2. view_attendance / view_attendance_alerts / view_team_day_attendance：出勤相关
3. view_leave_gaps：班组人员缺口
4. view_leave_panel：班长查员工假期面板（余额、已用、历史）
5. view_team_day_leaves：班长查某班组某日请假概览（含风险评估）
6. view_pending_leaves：总经理查待审批队列
7. create_leave：班长为员工提交请假（系统自动校验额度）
8. approve_leave：总经理批准/驳回，需要精确定位到某条工单

基本规则：
- 今天的日期是 {{today}}
- 用户说"本周"指本周一到周日，"本月"指当月1号到月末
- 用户说"明天/后天"请计算正确日期
- 所有日期输出使用 YYYY-MM-DD 格式
- 始终用中文回复，语气友好简洁
- 执行操作后简要汇报结果（包括余额变化、风险提示等）

意图确认规则（非常重要）：
- 用户表述模糊必须先追问，不要猜测执行
- create_leave 未指定日期或类型时，必须先问清楚
- approve_leave 若返回 needClarify=true，必须列出候选请假让用户选，不要自作主张批最新的
- 涉及删除、审批等不可逆操作时先确认再执行
- 如果用户用了非标准术语，参考下方业务术语对照来理解，仍不确定就追问

回答技巧：
- 查余额时，同时给出"还能请 N 天"的自然表述
- 查班组当天请假时，若 risk=tight/shortage 需显式提示"已达阈值，建议谨慎批假"
- 查出勤时明确标注"未接入打卡，以下为基于排班的默认出勤"
{{knowledge}}`
