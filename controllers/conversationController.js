const Conversation = require("../models/conversation");

const create_conversation = (req, res) => {
  const userList = [...req.body.users, res.locals.user._id];

  Conversation.find({ users: userList })
    .then((conversations) => {
      if (conversations.length > 0) {
        res.send({ error: "Conversation between these users already exists." });
      } else {
        let conversation = new Conversation({
          messages: [],
          users: userList,
        });

        let saveConversation = () => {
          conversation
            .save()
            .then((convo) => {
              res.send(convo);
            })
            .catch((err) => next(err));
        };
        saveConversation();
      }
    })
    .catch((err) => next(err));
};

const get_conversations = async (req, res, next) => {
  const conversations = await Conversation.find({ users: res.locals.user._id })
    .populate("users", "username profilePicture")
    .populate("messages.user", "username profilePicture")
    .exec();

  res.send(conversations);
};

const send_message = async (req, res) => {
  const newMessage = {
    user: res.locals.user._id,
    message: req.body.message,
  };
  Conversation.findOneAndUpdate(
    { _id: req.body.conversationId, users: res.locals.user._id },
    { $addToSet: { messages: newMessage } },
    { new: true }
  )
    .populate("messages.user", "firstName lastName profilePicture")
    .exec((err, convo) => {
      if (err) return next(err);
      if (convo) {
        res.send(convo);
      } else {
        res.send({ error: "Conversation not found." });
      }
    });
};

const delete_message = async (req, res) => {
  Conversation.findOneAndUpdate(
    { _id: req.body.conversationId, users: res.locals.user._id },
    { $pull: { messages: { _id: req.body.messageId, user: res.locals.user._id } } },
    { new: true }
  )
    .populate("messages.user", "username profilePicture")
    .exec((err, convo) => {
      if (err) return next(err);
      if (convo) {
        res.send(convo);
      } else {
        res.send({ error: "Conversation not found." });
      }
    });
};

module.exports = {
  create_conversation,
  get_conversations,
  send_message,
  delete_message,
};
