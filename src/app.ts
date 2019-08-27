import { TemplateMessage, TextMessage, WebhookEvent, WebhookRequestBody, ReplyableEvent, Message } from '@line/bot-sdk'

function doPost(e: GoogleAppsScript.Events.DoPost) {
  // 署名検証

  const accessToken: string = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN')

  const requestBody: WebhookRequestBody = JSON.parse(e.postData.contents)
  const event: WebhookEvent = requestBody.events[0]
  if (event.type === 'message') {
    if (event.message.type === "text") {
      replyMessage(accessToken, event.replyToken, createTextMessage(`「${event.message.text}」を受信しました。`))
    }
  }
  if (event.type === 'postback') {
      if (event.postback.data === 'yes') {
      } else {
      }
  }

  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
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
    type: "text",
    text: text
  }
}

function createConfirmMessage(): TemplateMessage {
  return {
    type: "template",
    altText: "cannot display template message",
    template: {
      type: "confirm",
      text: "確認",
      actions: [
        {
          type: "message",
          label: "はい",
          text: "yes"
        },
        {
          type: "message",
          label: "いいえ",
          text: "no"
        }
      ]
    }
  }
}