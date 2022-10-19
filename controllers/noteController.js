const Note = require('../models/note');

const create_note = (req, res, next) => {
    let note = new Note({
        ...req.body,
        date: new Date(),
        user: res.locals.user._id,
        firstName: res.locals.user.firstName,
        lastName: res.locals.user.lastName,
    });
    let saveNote = () => {
        note.save((err) => {
            if (err) return next(err);
            res.send({
                status: 'success',
                note
            })
        });
    }
    saveNote();
}

const update_note = (req, res, next) => {
    Note.findByIdAndUpdate(req.body._id, { note: req.body.note }, { new: true }, (err, note) => {
        if (err) return next(err);
        else {
            res.send({ note });
        }
    })
}

const get_notes = (req, res, next) => {
    Note.find({ user: res.locals.user._id }, function (err, data) {
        if (err) return next(err);
        console.log('ran')
        res.send(data || { results: "No Results" });
    });
}

module.exports = {
    create_note,
    update_note,
    get_notes,
}