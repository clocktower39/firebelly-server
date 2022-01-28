const Note = require('../models/note');

const create_note = (req, res) => {
    let note = new Note({
        ...req.body,
        date: new Date(),
        accountId: res.locals.user._id,
    });
    let saveNote = () => {
        note.save((err) => {
            if (err) {
                console.log(err);
                res.send({ error: { err } });
            }
            else {
                res.send({
                    status: 'success',
                    note
                })
            }
        });
    }
    saveNote();
}

const update_note = (req, res) => {
    Note.findByIdAndUpdate(req.body._id, { note: req.body.note }, { new: true}, (err, note) => {
        if (err) throw err;
        else {
            res.send({ note });
        }
    })
}

const get_notes = (req, res) => {
    Note.find({ accountId: res.locals.user._id }, function(err, data) {
        if(err) throw err;
        res.send(data||{ results: "No Results"});
    });
}

module.exports = {
    create_note,
    update_note,
    get_notes,
}