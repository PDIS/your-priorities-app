var express = require('express');
var router = express.Router();
var models = require("../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');
var async = require('async');
var crypto = require("crypto");
var seededShuffle = require("knuth-shuffle-seeded");
var multer = require('multer');
var s3multer = require('multer-s3');
var aws = require('aws-sdk');
var getExportFileDataForGroup = require('../utils/export_utils').getExportFileDataForGroup;
var moment = require('moment');
var sanitizeFilename = require("sanitize-filename");
var queue = require('../active-citizen/workers/queue');

var s3 = new aws.S3({
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  endpoint: process.env.S3_ENDPOINT || null,
  acl: 'public-read',
  region: process.env.S3_REGION || (process.env.S3_ENDPOINT ? null : 'us-east-1'),
})

var sendGroupOrError = function (res, group, context, user, error, errorStatus) {
  if (error || !group) {
    if (errorStatus == 404) {
      log.warn("Group Not Found", { context: context, group: toJson(group), user: toJson(user), err: error,
                                       errorStatus: 404 });
    } else {
      log.error("Group Error", { context: context, group: toJson(group), user: toJson(user), err: error,
                                 errorStatus: errorStatus ? errorStatus : 500 });
    }
    if (errorStatus) {
      res.sendStatus(errorStatus);
    } else {
      res.sendStatus(500);
    }
  } else {
    res.send(group);
  }
};

var getGroupAndUser = function (groupId, userId, userEmail, callback) {
  var user, group;

  async.series([
    function (seriesCallback) {
      models.Group.find({
        where: {
          id: groupId
        }
      }).then(function (groupIn) {
        if (groupIn) {
          group = groupIn;
        }
        seriesCallback();
      }).catch(function (error) {
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      if (userId) {
        models.User.find({
          where: {
            id: userId
          },
          attributes: ['id','email','name','created_at']
        }).then(function (userIn) {
          if (userIn) {
            user = userIn;
          }
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        });
      } else {
        seriesCallback();
      }
    },
    function (seriesCallback) {
      if (userEmail) {
        models.User.find({
          where: {
            email: userEmail
          },
          attributes: ['id','email','name','created_at']
        }).then(function (userIn) {
          if (userIn) {
            user = userIn;
          }
          seriesCallback();
        }).catch(function (error) {
          seriesCallback(error);
        });
      } else {
        seriesCallback();
      }
    }
  ], function (error) {
    if (error) {
      callback(error)
    } else {
      callback(null, group, user);
    }
  });
};

var truthValueFromBody = function(bodyParameter) {
  if (bodyParameter && bodyParameter!="") {
    return true;
  } else {
    return false;
  }
};

var updateGroupConfigParamters = function (req, group) {
  if (!group.configuration) {
    group.set('configuration', {});
  }
  group.set('configuration.canVote', truthValueFromBody(req.body.canVote));
  group.set('configuration.canAddNewPosts', truthValueFromBody(req.body.canAddNewPosts));
  group.set('configuration.disableDebate', truthValueFromBody(req.body.disableDebate));
  group.set('configuration.locationHidden', truthValueFromBody(req.body.locationHidden));
  group.set('configuration.showWhoPostedPosts', truthValueFromBody(req.body.showWhoPostedPosts));
  group.set('configuration.allowAnonymousUsers', truthValueFromBody(req.body.allowAnonymousUsers));
  group.set('configuration.allowAnonymousAutoLogin', truthValueFromBody(req.body.allowAnonymousAutoLogin));

  group.set('configuration.hideAllTabs', truthValueFromBody(req.body.hideAllTabs));
  group.set('configuration.hideNewPostOnPostPage', truthValueFromBody(req.body.hideNewPostOnPostPage));
  group.set('configuration.newPointOptional', truthValueFromBody(req.body.newPointOptional));
  group.set('configuration.hideHelpIcon', truthValueFromBody(req.body.hideHelpIcon));
  group.set('configuration.hideEmoji', truthValueFromBody(req.body.hideEmoji));
  group.set('configuration.hideGroupHeader', truthValueFromBody(req.body.hideGroupHeader));
  group.set('configuration.hidePointAuthor', truthValueFromBody(req.body.hidePointAuthor));
  group.set('configuration.hidePostAuthor', truthValueFromBody(req.body.hidePostAuthor));
  group.set('configuration.hideDownVoteForPost', truthValueFromBody(req.body.hideDownVoteForPost));

  group.set('configuration.attachmentsEnabled', truthValueFromBody(req.body.attachmentsEnabled));
  group.set('configuration.moreContactInformation', truthValueFromBody(req.body.moreContactInformation));

  group.set('configuration.endorsementButtons', (req.body.endorsementButtons && req.body.endorsementButtons!="") ? req.body.endorsementButtons : "hearts");
  group.set('configuration.alternativeHeader', (req.body.alternativeHeader && req.body.alternativeHeader!="") ? req.body.alternativeHeader : null);
  group.set('configuration.defaultLocationLongLat', (req.body.defaultLocationLongLat && req.body.defaultLocationLongLat!="") ? req.body.defaultLocationLongLat : null);

  group.set('configuration.postDescriptionLimit', (req.body.postDescriptionLimit && req.body.postDescriptionLimit!="") ? req.body.postDescriptionLimit : "500");

  if (truthValueFromBody(req.body.status)) {
    group.status = req.body.status;
  }

  if (truthValueFromBody(req.body.defaultLocale)) {
    group.set('configuration.defaultLocale', req.body.defaultLocale);
  }

  if (truthValueFromBody(req.body.uploadedDefaultDataImageId)) {
    group.set('configuration.defaultDataImageId', req.body.uploadedDefaultDataImageId);
  }

  if (truthValueFromBody(req.body.uploadedDefaultPostImageId)) {
    group.set('configuration.uploadedDefaultPostImageId', req.body.uploadedDefaultPostImageId);
  }

  group.set('configuration.alternativePointForHeader', (req.body.alternativePointForHeader && req.body.alternativePointForHeader!="") ? req.body.alternativePointForHeader : null);
  group.set('configuration.alternativePointAgainstHeader', (req.body.alternativePointAgainstHeader && req.body.alternativePointAgainstHeader!="") ? req.body.alternativePointAgainstHeader : null);

  group.set('configuration.alternativePointForLabel', (req.body.alternativePointForLabel && req.body.alternativePointForLabel!="") ? req.body.alternativePointForLabel : null);
  group.set('configuration.alternativePointAgainstLabel', (req.body.alternativePointAgainstLabel && req.body.alternativePointAgainstLabel!="") ? req.body.alternativePointAgainstLabel : null);
  group.set('configuration.disableFacebookLoginForGroup', truthValueFromBody(req.body.disableFacebookLoginForGroup));
  group.set('configuration.disableNameAutoTranslation', truthValueFromBody(req.body.disableNameAutoTranslation));
  group.set('configuration.externalGoalTriggerUrl', (req.body.externalGoalTriggerUrl && req.body.externalGoalTriggerUrl!="") ? req.body.externalGoalTriggerUrl : null);
  group.set('configuration.hideNewPost', truthValueFromBody(req.body.hideNewPost));

  group.set('configuration.hideVoteCount', truthValueFromBody(req.body.hideVoteCount));
  group.set('configuration.hideVoteCountUntilVoteCompleted', truthValueFromBody(req.body.hideVoteCountUntilVoteCompleted));
  group.set('configuration.hidePostCover', truthValueFromBody(req.body.hidePostCover));
  group.set('configuration.hidePostDescription', truthValueFromBody(req.body.hidePostDescription));
  group.set('configuration.hideDebateIcon', truthValueFromBody(req.body.hideDebateIcon));
  group.set('configuration.disablePostPageLink', truthValueFromBody(req.body.disablePostPageLink));
  group.set('configuration.hidePostActionsInGrid', truthValueFromBody(req.body.hidePostActionsInGrid));
  group.set('configuration.forceSecureSamlLogin', truthValueFromBody(req.body.forceSecureSamlLogin));
  group.set('configuration.hidePostFilterAndSearch', truthValueFromBody(req.body.hidePostFilterAndSearch));
  group.set('configuration.allowPostVideoUploads', truthValueFromBody(req.body.allowPostVideoUploads));
  group.set('configuration.allowPointVideoUploads', truthValueFromBody(req.body.allowPointVideoUploads));
  group.set('configuration.hidePostImageUploads', truthValueFromBody(req.body.hidePostImageUploads));
  group.set('configuration.useVideoCover', truthValueFromBody(req.body.useVideoCover));
  group.set('configuration.videoPostUploadLimitSec', (req.body.videoPostUploadLimitSec && req.body.videoPostUploadLimitSec!="") ? req.body.videoPostUploadLimitSec : "60");
  group.set('configuration.videoPointUploadLimitSec', (req.body.videoPointUploadLimitSec && req.body.videoPointUploadLimitSec!="") ? req.body.videoPointUploadLimitSec : "30");
  if (group.configuration.videoPostUploadLimitSec && parseInt(group.configuration.videoPostUploadLimitSec)) {
    if (parseInt(group.configuration.videoPostUploadLimitSec)>150) {
      group.set('configuration.videoPostUploadLimitSec', 150);
    }
  }
  if (group.configuration.videoPointUploadLimitSec && parseInt(group.configuration.videoPointUploadLimitSec)) {
    if (parseInt(group.configuration.videoPointUploadLimitSec)>90) {
      group.set('configuration.videoPointUploadLimitSec', 90);
    }
  }
};

var upload = multer({
  storage: s3multer({
    dirname: 'attachments',
    s3: s3,
    bucket: process.env.S3_BUCKET,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    endpoint: process.env.S3_ENDPOINT || null,
    acl: 'public-read',
    contentType: s3multer.AUTO_CONTENT_TYPE,
    region: process.env.S3_REGION || (process.env.S3_ENDPOINT ? null : 'us-east-1'),
    key: function (req, file, cb) {
      cb(null, Date.now()+"_"+file.originalname);
    }
  })
});

router.post('/:id/upload_document',  auth.can('add to group'), upload.single('file'), function(req, res) {
  res.send({filename: req.file.originalname, url: req.file.location });
});

router.delete('/:groupId/:activityId/delete_activity', auth.can('edit group'), function(req, res) {
  models.AcActivity.find({
    where: {
      group_id: req.params.groupId,
      id: req.params.activityId
    }
  }).then(function (activity) {
    activity.deleted = true;
    activity.save().then(function () {
      res.send( { activityId: activity.id });
    })
  }).catch(function (error) {
    log.error('Could not delete activity for group', {
      err: error,
      context: 'delete_activity',
      user: toJson(req.user.simple())
    });
    res.sendStatus(500);
  });
});

router.delete('/:groupId/user_membership', auth.isLoggedIn, auth.can('view group'), function(req, res) {
  getGroupAndUser(req.params.groupId, req.user.id, null, function (error, group, user) {
    if (error) {
      log.error('Could not remove user', { err: error, groupId: req.params.groupId, userRemovedId: req.user.id, context: 'user_membership', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && group) {
      group.removeGroupUsers(user).then(function (results) {
        log.info('User removed', {context: 'remove_admin', groupId: req.params.groupId, userRemovedId: req.user.id, user: toJson(req.user.simple()) });
        res.send({ membershipValue: false, name: group.name });
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.post('/:groupId/user_membership', auth.isLoggedIn, auth.can('add to group'), function(req, res) {
  getGroupAndUser(req.params.groupId, req.user.id, null, function (error, group, user) {
    if (error) {
      log.error('Could not add user', { err: error, groupId: req.params.groupId, userRemovedId: req.user.id, context: 'user_membership', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && group) {
      group.addGroupUsers(user).then(function (results) {
        log.info('User Added', {context: 'user_membership', groupId: req.params.groupId, userRemovedId: req.user.id, user: toJson(req.user.simple()) });
        res.send({ membershipValue: true, name: group.name });
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.post('/:groupId/:userEmail/invite_user', auth.can('edit group'), function(req, res) {
  var invite, user, token;
  async.series([
    function(callback) {
      crypto.randomBytes(20, function(error, buf) {
        token = buf.toString('hex');
        callback(error);
      });
    },
    function(callback) {
      models.User.find({
        where: { email: req.params.userEmail },
        attributes: ['id','email']
      }).then(function (userIn) {
        if (userIn) {
          user = userIn;
        }
        callback();
      }).catch(function (error) {
        callback(error);
      });
    },
    function(callback) {
      models.Invite.create({
        token: token,
        expires_at: Date.now() + (3600000*24*30*365*1000),
        type: models.Invite.INVITE_TO_GROUP,
        group_id: req.params.groupId,
        domain_id: req.ypDomain.id,
        user_id: user ? user.id : null,
        from_user_id: req.user.id,
        metadata:  { toEmail: req.params.userEmail}
      }).then(function (inviteIn) {
        if (inviteIn) {
          invite = inviteIn;
          callback();
        } else {
          callback('Invite not found')
        }
      }).catch(function (error) {
        callback(error);
      });
    },
    function(callback) {
      models.AcActivity.inviteCreated({
        email: req.params.userEmail,
        user_id: user ? user.id : null,
        sender_user_id: req.user.id,
        sender_name: req.user.name,
        group_id: req.params.groupId,
        domain_id: req.ypDomain.id,
        invite_id: invite.id,
        token: token}, function (error) {
        callback(error);
      });
    }
  ], function(error) {
    if (error) {
      log.error('Send Invite Error', { user: user ? toJson(user) : null, context: 'invite_user', loggedInUser: toJson(req.user), err: error, errorStatus: 500 });
      res.sendStatus(500);
    } else {
      log.info('Send Invite Activity Created', { userEmail: req.params.userEmail, user: user ? toJson(user) : null, context: 'invite_user', loggedInUser: toJson(req.user) });
      res.sendStatus(200);
    }
  });
});

router.delete('/:groupId/:userId/remove_admin', auth.can('edit group'), function(req, res) {
  getGroupAndUser(req.params.groupId, req.params.userId, null, function (error, group, user) {
    if (error) {
      log.error('Could not remove admin', { err: error, groupId: req.params.groupId, userRemovedId: req.params.userId, context: 'remove_admin', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && group) {
      group.removeGroupAdmins(user).then(function (results) {
        log.info('Admin removed', {context: 'remove_admin', groupId: req.params.groupId, userRemovedId: req.params.userId, user: toJson(req.user.simple()) });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.delete('/:groupId/remove_many_admins', auth.can('edit group'), function(req, res) {
  queue.create('process-deletion', { type: 'remove-many-group-admins', userIds: req.body.userIds, groupId: req.params.groupId }).
        priority('high').removeOnComplete(true).save();
  log.info('Remove many admins started', { context: 'remove_many_admins', groupId: req.params.groupId, user: toJson(req.user.simple()) });
  res.sendStatus(200);
});

router.delete('/:groupId/remove_many_users_and_delete_content', auth.can('edit group'), function(req, res) {
  queue.create('process-deletion', { type: 'remove-many-group-users-and-delete-content', userIds: req.body.userIds, groupId: req.params.groupId }).
        priority('high').removeOnComplete(true).save();
  log.info('Remove many and delete many users content', { context: 'remove_many_users_and_delete_content', groupId: req.params.groupId, user: toJson(req.user.simple()) });
  res.sendStatus(200);
});

router.delete('/:groupId/remove_many_users', auth.can('edit group'), function(req, res) {
  queue.create('process-deletion', { type: 'remove-many-group-users', userIds: req.body.userIds, groupId: req.params.groupId }).
        priority('high').removeOnComplete(true).save();
  log.info('Remove many admins started', { context: 'remove_many_users', groupId: req.params.groupId, user: toJson(req.user.simple()) });
  res.sendStatus(200);
});

router.delete('/:groupId/:userId/remove_and_delete_user_content', auth.can('edit group'), function(req, res) {
  getGroupAndUser(req.params.groupId, req.params.userId, null, function (error, group, user) {
    if (error) {
      log.error('Could not remove_user', { err: error, groupId: req.params.groupId, userRemovedId: req.params.userId, context: 'remove_user', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && group) {
      group.removeGroupUsers(user).then(function (results) {
        if (group.counter_users > 0) {
          group.decrement("counter_users")
        }
        queue.create('process-deletion', { type: 'delete-group-user-content', userId: req.params.userId, groupId: req.params.groupId }).
              priority('high').removeOnComplete(true).save();
        log.info('User removed', {context: 'remove_and_delete_user_content', groupId: req.params.groupId, userRemovedId: req.params.userId, user: toJson(req.user.simple()) });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.delete('/:groupId/:userId/remove_user', auth.can('edit group'), function(req, res) {
  getGroupAndUser(req.params.groupId, req.params.userId, null, function (error, group, user) {
    if (error) {
      log.error('Could not remove_user', { err: error, groupId: req.params.groupId, userRemovedId: req.params.userId, context: 'remove_user', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && group) {
      group.removeGroupUsers(user).then(function (results) {
        if (group.counter_users > 0) {
          group.decrement("counter_users")
        }
        log.info('User removed', {context: 'remove_user', groupId: req.params.groupId, userRemovedId: req.params.userId, user: toJson(req.user.simple()) });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.post('/:groupId/:email/add_admin', auth.can('edit group'), function(req, res) {
  getGroupAndUser(req.params.groupId, null, req.params.email, function (error, group, user) {
    if (error) {
      log.error('Could not add admin', { err: error, groupId: req.params.groupId, userAddEmail: req.params.email, context: 'remove_admin', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && group) {
      group.addGroupAdmins(user).then(function (results) {
        log.info('Admin Added', {context: 'add_admin', groupId: req.params.groupId, userAddEmail: req.params.email, user: toJson(req.user.simple()) });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.get('/:groupId/pages', auth.can('view group'), function(req, res) {
  models.Group.find({
    where: { id: req.params.groupId},
    attributes: ['id'],
    include: [
      {
        model: models.Community,
        attributes: ['id'],
        include: [
          {
            model: models.Domain,
            attributes: ['id']
          }
        ]
      }
    ]
  }).then(function (group) {
    models.Page.getPages(req, { group_id: req.params.groupId , community_id: group.Community.id, domain_id: group.Community.Domain.id }, function (error, pages) {
      if (error) {
        log.error('Could not get pages for group', { err: error, context: 'pages', user: req.user ? toJson(req.user.simple()) : null });
        res.sendStatus(500);
      } else {
        log.info('Got Pages', {context: 'pages', user: req.user ? toJson(req.user.simple()) : null });
        res.send(pages);
      }
    });
    return null;
  }).catch(function (error) {
    log.error('Could not get pages for group', { err: error, context: 'pages', user: req.user ? toJson(req.user.simple()) : null});
    res.sendStatus(500);
  });
});

router.get('/:groupId/pages_for_admin', auth.can('edit group'), function(req, res) {
  models.Page.getPagesForAdmin(req, { group_id: req.params.groupId }, function (error, pages) {
    if (error) {
      log.error('Could not get page for admin for group', { err: error, context: 'pages_for_admin', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Got Pages For Admin', {context: 'pages_for_admin', user: toJson(req.user.simple()) });
      res.send(pages);
    }
  });
});

router.get('/:groupId/export_group', auth.can('edit group'), function(req, res) {
  getExportFileDataForGroup(req.params.groupId, req.ypDomain.domain_name, function (error, fileData) {
    if (error) {
      log.error('Could not export for group', { err: error, context: 'export_group', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      models.Group.find({
        where: {
          id: req.params.groupId
        },
        attributes: ["id", "name","community_id"]
      }).then(function (model) {
        if (model) {
          log.info('Got Export Admin', {context: 'export_group', user: toJson(req.user.simple()) });
          var groupName = sanitizeFilename(model.name).replace(/ /g,'');
          var dateString = moment(new Date()).format("DD_MM_YY_HH_mm");
          var filename = 'ideas_and_points_group_export_'+model.community_id+'_'+req.params.groupId+'_'+
                          groupName+'_'+dateString+'.csv';
          res.set({ 'content-type': 'application/octet-stream; charset=utf-8' });
          res.charset = 'utf-8';
          res.attachment(filename);
          res.send(fileData);
        } else {
          log.error('Cant find group', { err: error, context: 'export_group', user: toJson(req.user.simple()) });
          res.sendStatus(404);
        }
      }).catch(function (error) {
        log.error('Could not export for group', { err: error, context: 'export_group', user: toJson(req.user.simple()) });
        res.sendStatus(500);
      });
    }
  });
});

router.post('/:groupId/add_page', auth.can('edit group'), function(req, res) {
  models.Page.newPage(req, { group_id: req.params.groupId, content: {}, title: {} }, function (error, pages) {
    if (error) {
      log.error('Could not create page for admin for group', { err: error, context: 'new_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('New Community Page', {context: 'new_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.put('/:groupId/:pageId/update_page_locale', auth.can('edit group'), function(req, res) {
  models.Page.updatePageLocale(req, { group_id: req.params.groupId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not update locale for admin for group', { err: error, context: 'update_page_locale', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Community Page Locale Updated', {context: 'update_page_locale', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.put('/:groupId/:pageId/publish_page', auth.can('edit group'), function(req, res) {
  models.Page.publishPage(req, { group_id: req.params.groupId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not publish page for admin for group', { err: error, context: 'publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Community Page Published', {context: 'publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.put('/:groupId/:pageId/un_publish_page', auth.can('edit group'), function(req, res) {
  models.Page.unPublishPage(req, { group_id: req.params.groupId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not un-publish page for admin for group', { err: error, context: 'un_publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Community Page Un-Published', {context: 'un_publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.delete('/:groupId/:pageId/delete_page', auth.can('edit group'), function(req, res) {
  models.Page.deletePage(req, { group_id: req.params.groupId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not delete page for admin for group', { err: error, context: 'delete_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Commuity Page Published', {context: 'delete_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.post('/:groupId/post/news_story', auth.isLoggedIn, auth.can('add to group'), function(req, res) {
  models.Point.createNewsStory(req, req.body, function (error) {
    if (error) {
      log.error('Could not save news story point on post', { err: error, context: 'news_story', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Point News Story Created', {context: 'news_story', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.post('/:groupId/news_story', auth.isLoggedIn, auth.can('add to group'), function(req, res) {
  models.Point.createNewsStory(req, req.body, function (error) {
    if (error) {
      log.error('Could not save news story point on group', { err: error, context: 'news_story', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Point News Story Created', {context: 'news_story', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.get('/:groupId/admin_users', auth.can('edit group'), function (req, res) {
  models.Group.find({
    where: {
      id: req.params.groupId
    },
    include: [
      {
        model: models.User,
        attributes: _.concat(models.User.defaultAttributesWithSocialMediaPublicAndEmail, ['created_at', 'last_login_at']),
        as: 'GroupAdmins',
        required: true,
        include: [
          {
            model: models.Organization,
            attributes: ['id', 'name'],
            as: 'OrganizationUsers',
            required: false
          }
        ]
      }
    ]
  }).then(function (group) {
    log.info('Got admin users', { context: 'admin_users', user: toJson(req.user.simple()) });
    if (group) {
      res.send(group.GroupAdmins);
    } else {
      res.send([]);
    }
  }).catch(function (error) {
    log.error('Could not get admin users', { err: error, context: 'admin_users', user: toJson(req.user.simple()) });
    res.sendStatus(500);
  });
});

router.get('/:groupId/users', auth.can('edit group'), function (req, res) {
  models.Group.find({
    where: {
      id: req.params.groupId
    },
    include: [
      {
        model: models.User,
        attributes: _.concat(models.User.defaultAttributesWithSocialMediaPublicAndEmail, ['created_at', 'last_login_at']),
        as: 'GroupUsers',
        required: true,
        include: [
          {
            model: models.Organization,
            attributes: ['id', 'name'],
            as: 'OrganizationUsers',
            required: false
          }
        ]
      }
    ]
  }).then(function (group) {
    log.info('Got users', { context: 'users', user: toJson(req.user.simple()) });
    if (group) {
      res.send(group.GroupUsers);
    } else {
      res.send([]);
    }
  }).catch(function (error) {
    log.error('Could not get admin users', { err: error, context: 'users', user: toJson(req.user.simple()) });
    res.sendStatus(500);
  });
});

router.get('/:groupId/default_post_image/:imageId', auth.can('view group'), function (req, res) {
  models.Image.find({
    where: {
      id: req.params.imageId
    }
  }).then(function (image) {
    if (image) {
      var formats = JSON.parse(image.formats);
      res.redirect(formats[0]);
    } else {
      res.sendStatus(200);
    }
  }).catch(function (error) {
    log.error('Could not get image', { err: error, context: 'post_default_image' });
    res.sendStatus(500);
  });
});

router.post('/:communityId', auth.can('create group'), function(req, res) {
  var group = models.Group.build({
    name: req.body.name,
    objectives: req.body.objectives,
    access: models.Group.convertAccessFromRadioButtons(req.body),
    domain_id: req.ypDomain.id,
    user_id: req.user.id,
    community_id: req.params.communityId,
    user_agent: req.useragent.source,
    ip_address: req.clientIp
  });

  group.theme_id = req.body.themeId ? parseInt(req.body.themeId) : null;

  updateGroupConfigParamters(req, group);

  group.save().then(function(group) {
    log.info('Group Created', { group: toJson(group), context: 'create', user: toJson(req.user) });
    group.updateAllExternalCounters(req, 'up', 'counter_groups', function () {
      models.Group.addUserToGroupIfNeeded(group.id, req, function () {
        group.addGroupAdmins(req.user).then(function (results) {
          group.setupImages(req.body, function(error) {
            sendGroupOrError(res, group, 'setupImages', req.user, error);
          });
        });
      });
    })
  }).catch(function(error) {
    sendGroupOrError(res, null, 'create', req.user, error);
  });
});

router.put('/:id', auth.can('edit group'), function(req, res) {
  models.Group.find({
    where: {id: req.params.id },
    include: [
      {
        model: models.Community,
        required: true,
        attributes: ['id','access']
      }
    ]
  }).then(function (group) {
    if (group) {
      group.name =req.body.name;
      group.objectives = req.body.objectives;
      group.theme_id = req.body.themeId ? parseInt(req.body.themeId) : null;
      group.access = models.Group.convertAccessFromRadioButtons(req.body);
      updateGroupConfigParamters(req, group);
      group.save().then(function () {
        log.info('Group Updated', { group: toJson(group), context: 'update', user: toJson(req.user) });
        group.setupImages(req.body, function(error) {
          sendGroupOrError(res, group, 'setupImages', req.user, error);
        });
      }).catch(function(error) {
        sendGroupOrError(res, null, 'update', req.user, error);
      });
    } else {
      sendGroupOrError(res, req.params.id, 'update', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendGroupOrError(res, null, 'update', req.user, error);
  });
});

router.delete('/:id', auth.can('edit group'), function(req, res) {
  models.Group.find({
    where: {id: req.params.id }
  }).then(function (group) {
    if (group) {
      group.deleted = true;
      group.save().then(function () {
        log.info('Group Deleted', { group: toJson(group), context: 'delete', user: toJson(req.user) });
        queue.create('process-deletion', { type: 'delete-group-content', resetCounters: true, groupName: group.name,
                                           userId: req.user.id, groupId: group.id }).priority('high').removeOnComplete(true).save();
        group.updateAllExternalCounters(req, 'down', 'counter_groups', function () {
          res.sendStatus(200);
        });
      });
    } else {
      sendGroupOrError(res, req.params.id, 'delete', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendGroupOrError(res, null, 'delete', req.user, error);
  });
});

router.delete('/:id/delete_content', auth.can('edit group'), function(req, res) {
  models.Group.find({
    where: {id: req.params.id }
  }).then(function (group) {
    if (group) {
      log.info('Group Delete Content', { group: toJson(group), context: 'delete', user: toJson(req.user) });
      queue.create('process-deletion', { type: 'delete-group-content', groupName: group.name,
                                         userId: req.user.id, groupId: group.id, useNotification: true,
                                         resetCounters: true }).priority('high').removeOnComplete(true).save();
      res.sendStatus(200);
    } else {
      sendGroupOrError(res, req.params.id, 'delete', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendGroupOrError(res, null, 'delete', req.user, error);
  });
});

router.delete('/:id/anonymize_content', auth.can('edit group'), function(req, res) {
  const anonymizationDelayMs = 1000*60*60*24*7;
  models.Group.find({
    where: {id: req.params.id }
  }).then(function (group) {
    if (group) {
      log.info('Group Anonymize Content with delay', { group: toJson(group), anonymizationDelayMs: anonymizationDelayMs,
                                                       context: 'delete', userId: toJson(req.user.id) });
      queue.create('process-anonymization', { type: 'notify-group-users', groupName: group.name,
                                              userId: req.user.id, groupId: group.id, delayMs: anonymizationDelayMs}).
                                            priority('high').removeOnComplete(true).save();
      queue.create('process-anonymization', { type: 'anonymize-group-content', groupName: group.name,
                                              userId: req.user.id, groupId: group.id, useNotification: true,
                                              resetCounters: true }).
                                              delay(anonymizationDelayMs).priority('high').removeOnComplete(true).save();
      res.sendStatus(200);
    } else {
      sendGroupOrError(res, req.params.id, 'delete', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendGroupOrError(res, null, 'delete', req.user, error);
  });
});

router.get('/:id', auth.can('view group'), function(req, res) {
  models.Group.find({
    where: { id: req.params.id },
    order: [
      [ { model: models.Image, as: 'GroupLogoImages' } , 'created_at', 'asc' ],
      [ { model: models.Image, as: 'GroupHeaderImages' } , 'created_at', 'asc' ],
      [ { model: models.Video, as: "GroupLogoVideos" }, 'updated_at', 'desc' ]
    ],
    include: [
      {
        model: models.Community,
        attributes: ['id','theme_id','name','access','google_analytics_code','configuration'],
        include: [
          {
            model: models.Domain,
            attributes: ['id','theme_id','name']
          }
        ]
      },
      {
        model: models.Category,
        required: false,
        include: [
          {
            model: models.Image,
            required: false,
            as: 'CategoryIconImages',
            attributes:  models.Image.defaultAttributesPublic,
            order: [
              [ { model: models.Image, as: 'CategoryIconImages' } ,'updated_at', 'asc' ]
            ]
          }
        ]
      },
      {
        model: models.Image,
        as: 'GroupLogoImages',
        attributes:  models.Image.defaultAttributesPublic,
        required: false
      },
      {
        model: models.Video,
        as: 'GroupLogoVideos',
        attributes:  ['id','formats','viewable'],
        required: false
      },
      {
        model: models.Image,
        as: 'GroupHeaderImages',
        attributes:  models.Image.defaultAttributesPublic,
        required: false
      }
    ]
  }).then(function(group) {
    if (group) {
      log.info('Group Viewed', { group: toJson(group.simple()), context: 'view', user: toJson(req.user) });
      var PostsByNotOpen = models.Post.scope('not_open');
      PostsByNotOpen.count({ where: { status: { $in: ['published','inactive']}, group_id: req.params.id} }).then(function (count) {
        res.send({group: group, hasNonOpenPosts: count != 0});
      }).catch(function (error) {
        sendGroupOrError(res, null, 'count_posts', req.user, error);
      });
    } else {
      sendGroupOrError(res, req.params.id, 'view', req.user, 'Not found', 404);
    }
    return null;
  }).catch(function(error) {
    sendGroupOrError(res, null, 'view', req.user, error);
  });
});

router.get('/:id/translatedText', auth.can('view group'), function(req, res) {
  if (req.query.textType.indexOf("group") > -1) {
    models.Group.find({
      where: {
        id: req.params.id
      },
      attributes: ['id','name','objectives']
    }).then(function(group) {
      if (group) {
        models.TranslationCache.getTranslation(req, group, function (error, translation) {
          if (error) {
            sendGroupOrError(res, req.params.id, 'translated', req.user, error, 500);
          } else {
            res.send(translation);
          }
        });
        log.info('Group translatedTitle', {  context: 'translated' });
      } else {
        sendGroupOrError(res, req.params.id, 'translated', req.user, 'Not found', 404);
      }
    }).catch(function(error) {
      sendGroupOrError(res, null, 'translated', req.user, error);
    });
  } else {
    sendGroupOrError(res, req.params.id, 'translated', req.user, 'Wrong textType', 401);
  }
});

router.get('/:id/search/:term', auth.can('view group'), function(req, res) {
    log.info('Group Search', { groupId: req.params.id, context: 'view', user: toJson(req.user) });
    models.Post.search(req.params.term, req.params.id, models.Category).then(function(posts) {
      posts = _.reject(posts,function (post) {
        return post.deleted == true;
      });
      res.send({
        posts: posts,
        totalPostsCount: posts.length
      });
    });
});

var getPostsWithAllFromIds = function (postsWithIds, postOrder, done) {
  var collectedIds = _.map(postsWithIds, function (post) {
    return post.id;
  });
  models.Post.findAll({
    where: {
      id: {
        $in: collectedIds
      }
    },
    attributes: ['id','name','description','status','official_status','counter_endorsements_up','cover_media_type',
      'counter_endorsements_down','group_id','language','counter_points','counter_flags','location','created_at'],
    order: [
      models.sequelize.literal(postOrder),
      [ { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ],
      [ { model: models.Category }, { model: models.Image, as: 'CategoryIconImages' } ,'updated_at', 'asc' ],
      [ { model: models.Video, as: "PostVideos" }, 'updated_at', 'desc' ],
      [ { model: models.Video, as: "PostVideos" }, { model: models.Image, as: 'VideoImages' } ,'updated_at', 'asc' ]
    ],
    include: [
      {
        model: models.Category,
        attributes: { exclude: ['ip_address', 'user_agent'] },
        required: false,
        include: [
          {
            model: models.Image,
            required: false,
            attributes: { exclude: ['ip_address', 'user_agent'] },
            as: 'CategoryIconImages'
          }
        ]
      },
      {
        model: models.Video,
        attributes: ['id','formats','updated_at','viewable'],
        as: 'PostVideos',
        required: false,
        include: [
          {
            model: models.Image,
            as: 'VideoImages',
            attributes:["formats","updated_at"],
            required: false
          },
        ]
      },
      {
        model: models.PostRevision,
        attributes: { exclude: ['ip_address', 'user_agent'] },
        required: false
      },
      {
        model: models.Group,
        required: true,
        attributes: ['id','configuration']
      },
      { model: models.Image,
        attributes: { exclude: ['ip_address', 'user_agent'] },
        as: 'PostHeaderImages',
        required: false
      }
    ]
  }).then(function(posts) {
    done(null, posts);
  }).catch(function (error) {
    done(error);
  });
};

router.get('/:id/posts/:filter/:categoryId/:status?', auth.can('view group'), function(req, res) {

  var where = { status: { $in: ['published','inactive']}, group_id: req.params.id, deleted: false };

  var postOrder = "(counter_endorsements_up-counter_endorsements_down) DESC";

  if (req.params.filter=="newest") {
    postOrder = "created_at DESC";
  } else if (req.params.filter=="most_debated") {
    postOrder = "counter_points DESC";
  } else if (req.params.filter=="random") {
    postOrder = "created_at DESC";
  }

  console.log(req.params.categoryId);
  console.log(req.params);

  if (req.params.categoryId!='null') {
    where['category_id'] = req.params.categoryId;
  }

  log.info('Group Posts Viewed', { groupID: req.params.id, context: 'view', user: toJson(req.user) });

  var offset = 0;
  if (req.query.offset) {
    offset = parseInt(req.query.offset);
  }

  var PostsByStatus = models.Post.scope(req.params.status);
  PostsByStatus.findAll({
    where: where,
    attributes: ['id','status','official_status','language','counter_endorsements_up',
                 'counter_endorsements_down','created_at'],
    order: [
      models.sequelize.literal(postOrder)
    ]
  }).then(function(posts) {
    var totalPostsCount = posts.length;
    var rows = [];
    var postRows = posts;
    if (req.params.filter==="random" && req.query.randomSeed && postRows && postRows.length>0) {
      postRows = seededShuffle(postRows, req.query.randomSeed);
    }
    if (offset<postRows.length) {
      var toValue = offset+20;
      rows = _.slice(postRows, offset, toValue);
    }
    //TODO: Remove this hack by finding way to let sequelize work with offsets... (maybe in seq 4.0)
    getPostsWithAllFromIds(rows, postOrder, function (error, finalRows) {
      if (error) {
        log.error("Error getting group", { err: error });
        res.sendStatus(500);
      } else {
        if (req.params.filter==="random" && req.query.randomSeed && finalRows && finalRows.length>0) {
          finalRows = seededShuffle(finalRows, req.query.randomSeed);
        }
        res.send({
          posts: finalRows,
          totalPostsCount: totalPostsCount
        });
      }
    });
  }).catch(function (error) {
    log.error("Error getting group", { err: error });
    res.sendStatus(500);
  });
});

router.get('/:id/categories', auth.can('view group'), function(req, res) {
  models.Category.findAll({
    where: { group_id: req.params.id },
    limit: 20
  }).then(function(categories) {
    if (categories) {
      log.info('Group Categories Viewed', { group: req.params.id, context: 'view', user: toJson(req.user) });
      res.send(categories);
    } else {
      sendGroupOrError(res, req.params.id, 'view', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendGroupOrError(res, null, 'view categories', req.user, error);
  });
});

router.get('/:id/post_locations', auth.can('view group'), function(req, res) {
  models.Post.findAll({
    where: {
      location: {
        $ne: null
      },
      group_id: req.params.id
    },
    order: [
      [ { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ]
    ],
    include: [
      { model: models.Image,
        as: 'PostHeaderImages',
        required: false
      },
      {
        model: models.Group,
        attributes: ['id','configuration'],
        required: true
      }
    ],
    select: ['id', 'name', 'location']
  }).then(function (posts) {
    if (posts) {
      log.info('Group Post Locations Viewed', {
        communityId: req.params.id,
        context: 'view',
        user: toJson(req.user)
      });
      res.send(posts);
    } else {
      sendGroupOrError(res, null, 'view post locations', req.user, 'Not found', 404);
    }
  }).catch(function (error) {
    sendGroupOrError(res, null, 'view post locations', req.user, error);
  });
});

router.get('/:id/categories_count/:tabName', auth.can('view group'), function(req, res) {
  var categoriesCount, allPostCount;
  var status = null;
  if (req.params.tabName==="failed") {
    status = -2;
  } else if (req.params.tabName==="open") {
    status = 0;
  } else if (req.params.tabName==="in_progress") {
    status = -1;
  } else if (req.params.tabName==="successful") {
    status = 2;
  }
  if (status!==null) {
    async.parallel([
      function (parallelCallback) {
        models.Post.count({
          attributes: ['category_id'],
          where: {
            group_id: req.params.id,
            official_status: status
          },
          include: [{
            model: models.Category
          }],
          group: ['category_id']
        }).then(function (results) {
          categoriesCount=results;
          parallelCallback();
        }).catch(function (error) {
          parallelCallback(error);
        });
      },
      function (parallelCallback) {
        models.Post.count({
          where: {
            group_id: req.params.id,
            official_status: status
          }
        }).then(function (count) {
          allPostCount=count;
          parallelCallback();
        }).catch(function (error) {
          parallelCallback(error);
        });
      }
    ], function (error) {
      if (error) {
        sendGroupOrError(res, null, 'categories_count', req.user, error);
      } else {
        res.send({categoriesCount: categoriesCount, allPostCount: allPostCount});
      }
    });
  } else {
    sendGroupOrError(res, null, 'categories_count', req.user, "Cant find status for posts");
  }
});

router.put('/:id/:groupId/mergeWithGroup', auth.can('edit post'), function(req, res) {
  auth.authNeedsGroupAdminForCreate({id: req.params.groupId }, req, function (error, isAuthorized) {
    if (isAuthorized) {
      var inGroup, outGroup, post, outCommunityId, outDomainId;
      async.series([
        function (callback) {
          models.Group.find({
            where: {
              id: req.params.id
            },
            include: [
              {
                model: models.Community,
                required: true,
                include: [
                  {
                    model: models.Domain,
                    required: true,
                    attributes: models.Domain.defaultAttributesPublic
                  }
                ]
              }
            ]
          }).then(function (group) {
            inGroup = groupIn;
            callback();
          }).catch(function (error) {
            callback(error);
          });
        },
        function (callback) {
          models.Group.find({
            where: {
              id: req.params.groupId
            },
            include: [
              {
                model: models.Community,
                required: true,
                include: [
                  {
                    model: models.Domain,
                    required: true,
                    attributes: models.Domain.defaultAttributesPublic
                  }
                ]
              }
            ]
          }).then(function (group) {
            outGroup = group;
            outCommunityId = group.Community.id;
            outDomainId = group.Community.Domain.id;
            callback();
          }).catch(function (error) {
            callback(error);
          });
        },
        function (callback) {
          models.Post.findAll({
            where: {
              group_id: inGroup.id
            }
          }).then(function (posts) {
            async.eachSeries(posts, function (post, seriesCallback) {
              post.set('group_id', outGroup.id);
              post.save().then(function (results) {
                console.log("Have changed group id");
                models.AcActivity.findAll({
                  where: {
                    post_id: post.id
                  }
                }).then(function (activities) {
                  async.eachSeries(activities, function (activity, innerSeriesCallback) {
                    activity.set('group_id', outGroup.id);
                    activity.set('community_id', outCommunityId);
                    activity.set('domain_id', outDomainId);
                    activity.save().then(function (results) {
                      console.log("Have changed group and all: "+activity.id);
                      innerSeriesCallback();
                    });
                  }, function (error) {
                    seriesCallback(error);
                  })
                }).catch(function (error) {
                  seriesCallback(error);
                });
              }, function (error) {
                callback(error);
              });
            });
          }).catch(function (error) {
            callback(error);
          });
        }
      ], function (error) {
        if (error) {
          log.error("Merge with group", {  groupId: req.params.id, groupToId: req.params.groupId });
          res.sendStatus(500);
        } else {
          log.info("Merge with group", {  groupId: req.params.id, groupToId: req.params.groupId });
          res.sendStatus(200);
        }
      });
    } else {
      log.error("Merge with group", { groupId: req.params.id, groupToId: req.params.groupId });
      res.sendStatus(401);
    }
  });
});

module.exports = router;
