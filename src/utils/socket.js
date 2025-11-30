export const SOCKET_EVENTS = {
  ADDED_CONTACT: 'addedContact',
  SEND_MESSAGE: 'sendMessage',
  REACT_MESSAGE: 'reactMessage',
  CHANGE_STATUS: 'changeStatus',
  TYPING_MESSAGE: 'typing',
  STOP_TYPING_MESSAGE: 'stopTyping',
  UNREAD_MESSAGE: 'unreadMessage',
  READ_MESSAGE: 'readMessage',
  UPDATE_CHATLIST: 'updateChatList',
  REVOKE_MESSAGE: 'revokeMessage',
  DELETE_MESSAGE: 'deleteMessage',
  FRIEND_ONLINE: 'friendOnline',
  BLOCK_USER: 'blockedByUser',
  UNBLOCK_USER: 'unblockedByUser',
  PIN_MESSAGE: 'pinnedMessage',
};

export const emitAddedContact = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.ADDED_CONTACT, data);
};

export const emitSendedMessage = (io, receiverId, data) => {
  if (!io || !receiverId) {
    console.log('❌ emitSendedMessage: Missing io or receiverId', { io: !!io, receiverId });
    return;
  }
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.SEND_MESSAGE, data);
};

export const emitReactedMessage = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.REACT_MESSAGE, data);
};
export const emitChangedStatus = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.CHANGE_STATUS, data);
};
export const emitTypingMessage = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.TYPING_MESSAGE, data);
};

export const emitStopTypingMessage = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.STOP_TYPING_MESSAGE, data);
};

export const emitGetUnreadMessages = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.UNREAD_MESSAGE, data);
};

export const emitReadMessages = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.READ_MESSAGE, data);
};

export const emitUpdateChatList = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.UPDATE_CHATLIST, data);
};

export const emitRevokeMessage = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.REVOKE_MESSAGE, data);
};

export const emitDeleteMessage = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.DELETE_MESSAGE, data);
};
export const emitFriendOnline = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.FRIEND_ONLINE, data);
};

export const emitBlockedByUser = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.BLOCK_USER, data);
};

export const emitUnBlockedByUser = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.UNBLOCK_USER, data);
};

export const emitPinnedMessage = (io, receiverId, data) => {
  if (!io || !receiverId) return;
  io.to(receiverId.toString()).emit(SOCKET_EVENTS.PIN_MESSAGE, data);
};
