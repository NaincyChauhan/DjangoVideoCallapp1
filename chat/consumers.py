from email import message
import json
from time import sleep
from channels.generic.websocket import AsyncWebsocketConsumer
from django.dispatch import receiver

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "TextRoom"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        # set the connection
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print("Connection Desconnected")

    # Receive message from WebSocket
    async def receive(self, text_data):
        receive_dict = json.loads(text_data)
        message = receive_dict['message']

        action  = receive_dict['action']
        if(action == 'new-offer' or action == 'new-answer'):
            receiver_channel_name = receive_dict['message']['receiver_channel_name']
            receive_dict['message']['receiver_channel_name'] = self.channel_name
            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type':"send_sdp",
                    "message":receive_dict
                }
            )

            return

        receive_dict['message']['receiver_channel_name'] = self.channel_name
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type':"send_sdp",
                "message":receive_dict
            }
        )

    async def send_sdp(self,event):
        # print("this is event ",event)
        receive_dict = event['message']

        # send the message to other peer conntion
        await self.send(text_data=json.dumps(receive_dict))
    