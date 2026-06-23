import Notification from '../models/Notification.js'

export async function sendNotification(
  io,
  { recipient, actor, type, snippetId = null, snippetTitle = '' }
) {
  if (type !== 'ai_review_complete' && recipient.toString() === actor.toString()) return

  try {
    const notif = await Notification.create({
      recipient,
      actor,
      type,
      snippet: snippetId,
      meta: { snippetTitle },
    })

    const populated = await Notification.findById(notif._id)
      .populate('actor', 'username avatar')
      .lean()

    if (io) {
      io.to(recipient.toString()).emit('notification:new', populated)
    }
  } catch (err) {
    console.error('sendNotification error:', err.message)
  }
}
