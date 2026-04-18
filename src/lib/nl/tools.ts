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
      description: "审批（批准或驳回）指定员工的请假申请",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "请假员工姓名" },
          action: { type: "string", enum: ["approve", "reject"], description: "approve=批准，reject=驳回" },
          approverId: { type: "string", description: "审批人标识，可省略，默认 nl-system" },
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
]

export const SYSTEM_PROMPT = `你是"排班考勤助手"，帮助用户管理客服团队的排班、请假和出勤。

你的能力：
1. 查看排班 - 查看某人/某班组在某段时间的排班情况
2. 新建排班 - 给员工安排班次
3. 请假申请 - 帮员工提交请假
4. 审批请假 - 批准或驳回请假申请
5. 查看出勤 - 查看考勤统计
6. 导出排班 - 导出排班 Excel
7. 缺口预警 - 查看人员缺口
8. 出勤异常 - 查看异常预警

基本规则：
- 今天的日期是 {{today}}
- 用户说"本周"指本周一到周日，"本月"指当月1号到月末
- 用户说"明天"请计算正确日期
- 所有日期输出使用 YYYY-MM-DD 格式
- 始终用中文回复，语气友好简洁
- 当执行了操作后，简要汇报结果

意图确认规则（非常重要）：
- 当用户表述模糊、有多种理解时，必须先向用户确认，不要猜测执行
- 例如：用户说"排班"但没说日期 → 问"请问要排哪天的班？"
- 例如：用户说一个名字但系统找不到 → 告知并问"你是指XXX吗？"
- 涉及删除、审批等不可逆操作时，先确认再执行
- 如果用户用了非标准术语，参考下方业务术语对照来理解，如果仍不确定就追问
{{knowledge}}`
