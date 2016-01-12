var express = require('express');
var router = express.Router();
var models = require("../models");
var auth = require('../authorization');

router.post('/:communityId', auth.can('create group'), function(req, res) {
  var group = models.Group.build({
    name: req.body.name,
    objectives: req.body.objectives,
    access: models.Community.convertAccessFromRadioButtons(req.body),
    domain_id: req.ypDomain.id,
    user_id: req.user.id,
    community_id: req.params.communityId
  });

  group.save().then(function(group) {
    group.updateAllExternalCounters(req, 'up', function () {
      models.Group.addUserToGroupIfNeeded(group.id, req, function () {
        group.setupImages(req.body, function(err) {
          if (err) {
            res.sendStatus(403);
            console.error(err);
          } else {
            res.send(group);
          }
        });
      });
    })
  }).catch(function(error) {
    res.sendStatus(403);
  });
});

router.put('/:id', auth.can('edit group'), function(req, res) {
  models.Group.find({
    where: {id: req.params.id, user_id: req.user.id }
  }).then(function (group) {
    group.name =req.body.name;
    group.objectives = req.body.objectives;
    group.access = models.Community.convertAccessFromRadioButtons(req.body);
    group.save().then(function () {
      group.setupImages(req.body, function(err) {
        if (err) {
          res.sendStatus(403);
          console.error(err);
        } else {
          res.send(group);
        }
      });
    });
  });
});

router.delete('/:id', auth.can('edit group'), function(req, res) {
  models.Group.find({
    where: {id: req.params.id, user_id: req.user.id }
  }).then(function (group) {
    group.deleted = true;
    group.save().then(function () {
      group.updateAllExternalCounters(req, 'down', function () {
        res.sendStatus(200);
      });
    });
  });
});

router.get('/:id/search/:term', auth.can('view group'), function(req, res) {
  models.Group.find({
    where: { id: req.params.id },
    include: [
      {
        model: models.Category,
        include: [
          {
            model: models.Image,
            as: 'CategoryIconImages',
            order: [
              [ { model: models.Image, as: 'CategoryIconImages' } ,'updated_at', 'asc' ]
            ]
          }
        ]
      },
      {
        model: models.Image, as: 'GroupLogoImages'
      },
      {
        model: models.User, as: 'GroupUsers',
        attributes: ['id'],
        required: false
      }
    ]
  }).then(function(group) {
    models.Idea.search(req.params.term,req.params.id, models.Category).then(function(ideas) {
      res.send({group: group, Ideas: ideas});
    });
  });
});

router.get('/:id/ideas/:filter/:categoryId?', auth.can('view group'), function(req, res) {

  var where = '"Idea"."deleted" = false AND "Idea"."group_id" = '+req.params.id;
  //  var ideaOrder = [models.sequelize.fn('subtraction', models.sequelize.col('counter_endorsements_up'), models.sequelize.col('counter_endorsements_down')), 'DESC'];

  var ideaOrder = "(counter_endorsements_up-counter_endorsements_down) DESC";

  if (req.params.filter!="inProgress") {
    //where+=' AND "Idea"."status" = "published"';
  } else {
    //where+=' AND "Idea"."status" != "published" AND "Idea"."status" != "deleted"';
  }

  if (req.params.filter=="newest") {
    ideaOrder = "created_at DESC";
  } else if (req.params.filter=="random") {
    ideaOrder = "random()";
  }

  console.log(req.param["categoryId"]);
  console.log(req.params);

  if (req.params.categoryId!=undefined) {
    where+=' AND "Idea"."category_id" = '+ req.params.categoryId;
  }

  models.Group.find({
    where: { id: req.params.id },
    include: [
      {
        model: models.Category,
        include: [
          {
            model: models.Image,
            as: 'CategoryIconImages',
            order: [
              [ { model: models.Image, as: 'CategoryIconImages' } ,'updated_at', 'asc' ]
            ]
          }
        ]
      },
      {
        model: models.Image, as: 'GroupLogoImages'
      },
      {
        model: models.User, as: 'GroupUsers',
        attributes: ['id'],
        required: false
      }
    ]
  }).then(function(group) {
    models.Idea.findAll({
      where: [where, []],
      order: [
        models.sequelize.literal(ideaOrder),
        [ { model: models.Image, as: 'IdeaHeaderImages' } ,'updated_at', 'asc' ]
      ],
      include: [
        {
          model: models.Category,
          include: [
            {
              model: models.Image,
              as: 'CategoryIconImages',
              order: [
                [ { model: models.Image, as: 'CategoryIconImages' } ,'updated_at', 'asc' ]
              ]
            }
          ]
        },
        models.IdeaRevision,
        models.Point,
        { model: models.Image, as: 'IdeaHeaderImages' }
    ]
    }).then(function(ideas) {
      res.send({group: group, Ideas: ideas});
    });
  });
});

router.get('/:id/categories', auth.can('view group'), function(req, res) {
  models.Category.findAll({
    where: { group_id: req.params.id },
    limit: 20
  }).then(function(categories) {
    res.send(categories);
  });
});

module.exports = router;
