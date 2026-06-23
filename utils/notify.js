import Notification from '../models/Notification.js'

/**
 * Create a notification and push it in real-time via Socket.IO.
 *
 * @param {object} io          - Socket.IO server instance (from req.app.get('io'))
 * @param {object} opts
 * @param {string} opts.recipient    - User ID receiving the notification
 * @param {string} opts.actor        - User ID who triggered it
 * @param {string} opts.type         - Notification type enum value
 * @param {string} [opts.snippetId]  - Related snippet ID (optional)
 * @param {string} [opts.snippetTitle] - Stored at creation time so it survives snippet deletion
 */
export async function sendNotification(
  io,
  { recipient, actor, type, snippetId = null, snippetTitle = '' }
) {
  // Never notify yourself, unless it's an AI review completion
  if (type !== 'ai_review_complete' && recipient.toString() === actor.toString()) return

  try {
    const notif = await Notification.create({
      recipient,
      actor,
      type,
      snippet: snippetId,
      meta: { snippetTitle },
    })

    // Populate actor info so the frontend can render it immediately
    const populated = await Notification.findById(notif._id)
      .populate('actor', 'username avatar')
      .lean()

    // Push to the recipient's private socket room
    if (io) {
      io.to(recipient.toString()).emit('notification:new', populated)
    }
  } catch (err) {
    // Non-critical — never let a notification failure break the main request
    console.error('sendNotification error:', err.message)
  }
}
