import Notification from '../models/Notification.js'

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('actor', 'username avatar')
      .populate('snippet', 'title')
      .lean()

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    })

    res.json({ notifications, unreadCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    )
    res.json({ message: 'All notifications marked as read' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const markOneRead = async (req, res) => {
  try {
    const notif = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    })
    if (!notif)
      return res.status(404).json({ message: 'Notification not found' })

    notif.read = true
    await notif.save()
    res.json({ message: 'Notification marked as read' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
