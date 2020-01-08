import { WebhookEvent, WebhookRequestBody, Message, TextMessage, TemplateMessage } from '@line/bot-sdk'

function doPost(e: GoogleAppsScript.Events.DoPost) {
  const channelSecret: string = PropertiesService.getScriptProperties().getProperty('CHANNEL_SECRET')
  const signature = Utilities.base64Encode(Utilities.computeHmacSha256Signature(e.postData.contents, channelSecret))
  // TODO リクエストヘッダーからX-Line-Signatureを取得して署名検証

  const accessToken: string = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN')

  const requestBody: WebhookRequestBody = JSON.parse(e.postData.contents)
  const event: WebhookEvent = requestBody.events[0]
  if (event.type === 'message') {
    if (event.message.type === 'text') {
      const enabledBillsData: EnabledBillsData = {enabled : true, data :BillsData.parse(event.message.text)}
      const disabledBillsData: DisabledBillsData = {enabled : false}
      replyMessage(accessToken, event.replyToken, createConfirmMessage(`「${JSON.stringify(enabledBillsData.data)}」を受信しました。`, enabledBillsData, disabledBillsData))
    }
  }
  if (event.type === 'postback') {
    const postBackData: BillsPostBackData = JSON.parse(event.postback.data)
    let resultMessage: Message
    if (postBackData.enabled) {
      appendBillsCollection(postBackData.data)
      resultMessage = createTextMessage(`登録しました。PostBackData = ${event.postback.data}`)
    } else {
      resultMessage = createTextMessage(`キャンセルしました。PostBackData = ${event.postback.data}`)
    }
    replyMessage(accessToken, event.replyToken, resultMessage)
  }

  return ContentService.createTextOutput(JSON.stringify({ 'content': 'post ok' })).setMimeType(ContentService.MimeType.JSON)
}

function replyMessage(accessToken: string, replyToken: string, message: Message): GoogleAppsScript.URL_Fetch.HTTPResponse {
  const url: string = 'https://api.line.me/v2/bot/message/reply'
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [message]
    })
  }
  return UrlFetchApp.fetch(url, params)
}

function createTextMessage(text: string): TextMessage {
  return {
    type: 'text',
    text: text
  }
}

function createConfirmMessage(text: string, yesData: EnabledBillsData, noData: DisabledBillsData): TemplateMessage {
  return {
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
