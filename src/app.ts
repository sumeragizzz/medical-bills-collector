import { WebhookEvent, WebhookRequestBody, Message, TextMessage, TemplateMessage } from '@line/bot-sdk'

function doPost(e: GoogleAppsScript.Events.DoPost) {
  const channelSecret: string = PropertiesService.getScriptProperties().getProperty('CHANNEL_SECRET')
  const signature = Utilities.base64Encode(Utilities.computeHmacSha256Signature(e.postData.contents, channelSecret))
  // TODO リクエストヘッダーからX-Line-Signatureを取得して署名検証

  const accessToken: string = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN')

  const messagingService: MessagingService = new MessagingService()

  console.info('start')
  console.info(e.queryString)

  const requestBody: WebhookRequestBody = JSON.parse(e.postData.contents)
  const event: WebhookEvent = requestBody.events[0]
  if (event.type === 'message') {
    if (event.message.type === 'text') {
      const enabledBillsData: EnabledBillsData = {enabled : true, data :BillsData.parse(event.message.text)}
      const disabledBillsData: DisabledBillsData = {enabled : false}

      const text: string = `date: ${ enabledBillsData.data.dateString},\r\n institution: ${enabledBillsData.data.hospital},\r\n amount: ${enabledBillsData.data.amount}.`
      messagingService.confirm(text, event.replyToken, enabledBillsData, disabledBillsData)
    }
  }

  if (event.type === 'postback') {
    const postBackData: BillsPostBackData = JSON.parse(event.postback.data)
    if (postBackData.enabled) {
      appendBillsCollection(postBackData.data)
    }
    const text = (postBackData.enabled) ? `complete. PostBackData = ${event.postback.data}.` : `cancel. PostBackData = ${event.postback.data}.`;
    messagingService.reply(text, event.replyToken)
  }

  return ContentService.createTextOutput(JSON.stringify({ 'content': 'post ok' })).setMimeType(ContentService.MimeType.JSON)
}

function appendBillsCollection(billsData: BillsData) {
  const spreadsheetId: string = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  const spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.openById(spreadsheetId)
  const sheet: GoogleAppsScript.Spreadsheet.Sheet = spreadsheet.getSheetByName('シート1')
  sheet.appendRow([billsData.dateString, billsData.hospital, billsData.amount])
}

class BillsData {
  constructor(public dateString: string, public hospital: string, public amount: number) {
  }

  static parse(text: string): BillsData {
    const lines = text.split(/\r\n|\n|\r/)
    const dateString: string = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd')
    const hospital: string = lines[0]
    const amount: number = parseInt(lines[1])
    return new BillsData(dateString, hospital, amount)
  }
}

type EnabledBillsData = {enabled: true, data : BillsData}
type DisabledBillsData = {enabled: false}
type BillsPostBackData = EnabledBillsData | DisabledBillsData

// メッセージングサービス
class MessagingService {
  private static readonly URL: string = 'https://api.line.me/v2/bot/message/reply'
  private static readonly ACCESS_TOKEN: string = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN')

  send(text: string) {
    // TODO
  }

  reply(text: string, replyToken: string): GoogleAppsScript.URL_Fetch.HTTPResponse {
    const message: TextMessage = {
      type: 'text',
      text: text
    }
    return this.replyMessage(message, replyToken)
  }

  
  confirm(text: string, replyToken: string, yesData: any, noData: any): GoogleAppsScript.URL_Fetch.HTTPResponse {
    const message: TemplateMessage = {
      type: 'template',
      altText: 'cannot display template message',
      template: {
        type: 'confirm',
        text: text,
        actions: [
          {
            type: 'postback',
            label: 'はい',
            displayText: 'はい',
            data: JSON.stringify(yesData)
          },
          {
            type: 'postback',
            label: 'いいえ',
            displayText: 'いいえ',
            data: JSON.stringify(noData)
          }
        ]
      }
    }
    return this.replyMessage(message, replyToken)
  }

  private replyMessage(message: Message, replyToken: string): GoogleAppsScript.URL_Fetch.HTTPResponse {
    const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        Authorization: `Bearer ${MessagingService.ACCESS_TOKEN}`
      },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [message]
      })
    }
    return UrlFetchApp.fetch(MessagingService.URL, params)
  }
}

// 医療費サービス
class MedicalBillsService {
  repository: MedicalBillsRepository

  constructor() {
    this.repository = new MedicalBillsRepository()
  }

  create(medicalInstitutionName: string, amount: number): MedicalBills {
    return new MedicalBills(medicalInstitutionName, amount)
  }

  register(entity: MedicalBills): boolean {
    const existsEntity: MedicalBills = this.repository.findById(entity.id)
    if (existsEntity == null) {
      return false
    }
    this.repository.add(entity)
    return true
  }

  summary(yearMonth: Date): number {
    const firstDay: Date = new Date(yearMonth.getFullYear(), yearMonth.getMonth(), 1)
    const lastDay: Date = new Date(yearMonth.getFullYear(), yearMonth.getMonth() + 1, 0)
    const array: MedicalBills[] = this.repository.findByDate(firstDay, lastDay)

    return array.reduce((count: number, bills: MedicalBills) => count += bills.amount, 0)
  }
}

// 医療費エンティティ
class MedicalBills {
  id: string
  medicalInstitution: MedicalInstitution
  amount: number
  date: Date

  constructor(medicalInstitutionName: string, amount: number) {
    this.id = Utilities.getUuid()
    this.medicalInstitution = new MedicalInstitution(medicalInstitutionName)
    this.amount = amount
    this.date = new Date()
  }
}

// 医療機関エンティティ
class MedicalInstitution {
  id: string
  name: string
  
  constructor(name: string) {
    this.id = Utilities.getUuid()
    this.name = name
  }
}

// 医療費リポジトリ
class MedicalBillsRepository {
  sheet: GoogleAppsScript.Spreadsheet.Sheet

  constructor() {
    const spreadsheetId: string = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
    const spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.openById(spreadsheetId)
    // TODO シート名を固定ではなく別に定義する
    this.sheet = spreadsheet.getSheetByName('シート1')
  }

  add(entity: MedicalBills): void {
    this.sheet.appendRow([entity.id, entity.date, entity.medicalInstitution, entity.amount])
  }

  findById(id: string): MedicalBills | null {
    // TODO
    return null
  }

  findByDate(fromDate: Date, toDate: Date): MedicalBills[] {
    // TODO
    return null
  }
}
