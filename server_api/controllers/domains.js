var express = require('express');
var router = express.Router();
var models = require("../models");
var auth = require('../authorization');
var log = require('../utils/logger');
var toJson = require('../utils/to_json');
var _ = require('lodash');
var async = require('async');
var queue = require('../active-citizen/workers/queue');

var sendDomainOrError = function (res, domain, context, user, error, errorStatus) {
  if (error || !domain) {
    if (errorStatus == 404) {
      log.warn("Domain Not Found", { context: context, domain: toJson(domain), user: toJson(user), err: error,
        errorStatus: 404 });
    } else {
      log.error("Domain Error", { context: context, domain: toJson(domain), user: toJson(user), err: error,
        errorStatus: errorStatus ? errorStatus : 500 });
    }
    if (errorStatus) {
      res.sendStatus(errorStatus);
    } else {
      res.sendStatus(500);
    }
  } else {
    res.send(domain);
  }
};

var truthValueFromBody = function(bodyParameter) {
  return (bodyParameter && bodyParameter!=="");
};

var getDomain = function (req, domainId, done) {
  var domain;
  var attributes = null;
  var memberAdminCommunities;
  async.series([
    function (seriesCallback) {
      auth.hasDomainAdmin(domainId, req, function (error, isAdmin) {
          if (!isAdmin) {
            attributes = models.Domain.defaultAttributesPublic;
          }
        seriesCallback(error);
      });
    },
    function (seriesCallback) {
      models.Domain.find({
        where: {id: domainId},
        attributes: attributes,
        order: [
          [{model: models.Image, as: 'DomainLogoImages'}, 'created_at', 'asc'],
          [{model: models.Image, as: 'DomainHeaderImages'}, 'created_at', 'asc'],
          [{model: models.Video, as: "DomainLogoVideos" }, 'updated_at', 'desc' ]
        ],
        include: [
          {
            model: models.Image,
            as: 'DomainLogoImages',
            attributes:  models.Image.defaultAttributesPublic,
            required: false
          },
          {
            model: models.Video,
            as: 'DomainLogoVideos',
            attributes:  ['id','formats','viewable'],
            required: false
          },
          {
            model: models.Image,
            as: 'DomainHeaderImages',
            attributes:  models.Image.defaultAttributesPublic,
            required: false
          }
        ]
      }).then(function (domainIn) {
        domain = domainIn;
        if (domain) {
          models.Community.findAll({
            where: {
              domain_id: domain.id,
              access: {
                $ne: models.Community.ACCESS_SECRET
              },
              $or: [
                {
                  counter_users: {
                    $gt: 5
                  },
                },
                {
                  status: "featured"
                }
              ],
              status: {
                $ne: 'hidden'
              }
            },
            attributes: models.Community.defaultAttributesPublic,
            order: [
              [ 'counter_users', 'desc'],
              [ {model: models.Image, as: 'CommunityLogoImages'}, 'created_at', 'asc']
            ],
            include: [
              {
                model: models.Image,
                as: 'CommunityLogoImages',
                attributes:  models.Image.defaultAttributesPublic,
                required: false
              },
              {
                model: models.Image,
                as: 'CommunityHeaderImages',
                attributes:  models.Image.defaultAttributesPublic,
                order: 'created_at asc',
                required: false
              }
            ]
          }).then(function (communities) {
            log.info('Domain Viewed', {domain: toJson(domain.simple()), context: 'view', user: toJson(req.user)});
            if (req.ypDomain && req.ypDomain.secret_api_keys &&
              req.ypDomain.secret_api_keys.saml && req.ypDomain.secret_api_keys.saml.entryPoint &&
              req.ypDomain.secret_api_keys.saml.entryPoint.length > 6) {
              domain.dataValues.samlLoginProvided = true;
            }
            if (req.ypDomain && req.ypDomain.secret_api_keys &&
              req.ypDomain.secret_api_keys.facebook && req.ypDomain.secret_api_keys.facebook.client_secret &&
              req.ypDomain.secret_api_keys.facebook.client_secret.length > 6) {
              domain.dataValues.facebookLoginProvided = true;
            }
            domain.dataValues.Communities = communities;
            seriesCallback(null);
            return null;
          }).catch(function (error) {
            seriesCallback(error)
          });
        } else {
          seriesCallback("Not found")
        }
        return null;
      }).catch(function (error) {
        seriesCallback(error)
      });
    },
    function (seriesCallback) {
      if (req.user && domain) {
        var adminCommunities, userCommunities;

        async.parallel([
          function (parallelCallback) {
            models.Community.findAll({
              where: {
                domain_id: domain.id
              },
              order: [
                [ 'counter_users', 'desc'],
                [ {model: models.Image, as: 'CommunityLogoImages'}, 'created_at', 'asc']
              ],
              include: [
                {
                  model: models.Image, as: 'CommunityLogoImages',
                  required: false
                },
                {
                  model: models.Image, as: 'CommunityHeaderImages', order: 'created_at asc',
                  required: false
                },
                {
                  model: models.User,
                  as: 'CommunityAdmins',
                  attributes: ['id'],
                  required: true,
                  where: {
                    id: req.user.id
                  }
                }
              ]
            }).then(function (communities) {
              adminCommunities = communities;
              parallelCallback();
            }).catch(function (error) {
              parallelCallback(error)
            });
          },
          function (parallelCallback) {
            models.Community.findAll({
              where: {
                domain_id: domain.id
              },
              order: [
                [ 'counter_users', 'desc'],
                [ {model: models.Image, as: 'CommunityLogoImages'}, 'created_at', 'asc']
              ],
              include: [
                {
                  model: models.Image, as: 'CommunityLogoImages',
                  required: false
                },
                {
                  model: models.Image, as: 'CommunityHeaderImages', order: 'created_at asc',
                  required: false
                },
                {
                  model: models.User,
                  as: 'CommunityUsers',
                  attributes: ['id'],
                  required: true,
                  where: {
                    id: req.user.id
                  }
                }
              ]
            }).then(function (communities) {
              userCommunities = communities;
              parallelCallback();
            }).catch(function (error) {
              parallelCallback(error)
            });
          }
        ], function (error) {
          var combinedCommunities = _.concat(userCommunities, domain.dataValues.Communities);
          combinedCommunities = _.concat(adminCommunities, combinedCommunities);
          combinedCommunities = _.uniqBy(combinedCommunities, function (community) {
            return community.id;
          });

          domain.dataValues.Communities = combinedCommunities;

          seriesCallback(error);
        });
      } else {
        seriesCallback();
      }
    }
  ], function (error) {
    done(error, domain);
  });
};

var getDomainAndUser = function (domainId, userId, userEmail, callback) {
  var user, domain;

  async.series([
    function (seriesCallback) {
      models.Domain.find({
        where: {
          id: domainId
        }
      }).then(function (domainIn) {
        if (domainIn) {
          domain = domainIn;
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
      callback(null, domain, user);
    }
  });
};

router.delete('/:domainId/:activityId/delete_activity', auth.can('edit domain'), function(req, res) {
  models.AcActivity.find({
    where: {
      domain_id: req.params.domainId,
      id: req.params.activityId
    }
  }).then(function (activity) {
    activity.deleted = true;
    activity.save().then(function () {
      res.send( { activityId: activity.id });
    })
  }).catch(function (error) {
    log.error('Could not delete activity for domain', {
      err: error,
      context: 'delete_activity',
      user: toJson(req.user.simple())
    });
    res.sendStatus(500);
  });
});

router.get('/:domainId/pages', auth.can('view domain'), function(req, res) {
  models.Page.getPages(req, { domain_id: req.params.domainId }, function (error, pages) {
    if (error) {
      log.error('Could not get pages for domain', { err: error, context: 'pages', user: req.user ? toJson(req.user.simple()) : null });
      res.sendStatus(500);
    } else {
      log.info('Got Pages', {context: 'pages', user: req.user ? toJson(req.user.simple()) : null });
      res.send(pages);
    }
  });
});

router.get('/:domainId/pages_for_admin', auth.can('edit domain'), function(req, res) {
  models.Page.getPagesForAdmin(req, { domain_id: req.params.domainId }, function (error, pages) {
    if (error) {
      log.error('Could not get page for admin for domain', { err: error, context: 'pages_for_admin', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Got Pages For Admin', {context: 'pages_for_admin', user: toJson(req.user.simple()) });
      res.send(pages);
    }
  });
});

router.post('/:domainId/add_page', auth.can('edit domain'), function(req, res) {
  models.Page.newPage(req, { domain_id: req.params.domainId, content: {}, title: {} }, function (error, pages) {
    if (error) {
      log.error('Could not create page for admin for domain', { err: error, context: 'new_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('New Community Page', {context: 'new_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.get('/:domainId/users', auth.can('edit domain'), function (req, res) {
  models.Domain.find({
    where: {
      id: req.params.domainId
    },
    include: [
      {
        model: models.User,
        attributes: _.concat(models.User.defaultAttributesWithSocialMediaPublicAndEmail, ['created_at', 'last_login_at']),
        as: 'DomainUsers',
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
  }).then(function (domain) {
    log.info('Got users for domain', { context: 'users', user: toJson(req.user.simple()) });
    if (domain) {
      res.send(domain.DomainUsers);
    } else {
      res.send([]);
    }
  }).catch(function (error) {
    log.error('Could not get users for domain', { err: error, context: 'users', user: toJson(req.user.simple()) });
    res.sendStatus(500);
  });
});

router.get('/:domainId/admin_users', auth.can('edit domain'), function (req, res) {
  models.Domain.find({
    where: {
      id: req.params.domainId
    },
    include: [
      {
        model: models.User,
        attributes: _.concat(models.User.defaultAttributesWithSocialMediaPublicAndEmail, ['created_at', 'last_login_at']),
        as: 'DomainAdmins',
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
  }).then(function (domain) {
    log.info('Got admins for domain', { context: 'users', user: toJson(req.user.simple()) });
    if (domain) {
      res.send(domain.DomainAdmins);
    } else {
      res.send([]);
    }
  }).catch(function (error) {
    log.error('Could not get admin users for domain', { err: error, context: 'users', user: toJson(req.user.simple()) });
    res.sendStatus(500);
  });
});

router.put('/:domainId/:pageId/update_page_locale', auth.can('edit domain'), function(req, res) {
  models.Page.updatePageLocale(req, { domain_id: req.params.domainId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not update locale for admin for domain', { err: error, context: 'update_page_locale', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Community Page Locale Updated', {context: 'update_page_locale', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.put('/:domainId/:pageId/publish_page', auth.can('edit domain'), function(req, res) {
  models.Page.publishPage(req, { domain_id: req.params.domainId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not publish page for admin for domain', { err: error, context: 'publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Community Page Published', {context: 'publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.put('/:domainId/:pageId/un_publish_page', auth.can('edit domain'), function(req, res) {
  models.Page.unPublishPage(req, { domain_id: req.params.domainId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not un-publish page for admin for domain', { err: error, context: 'un_publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Community Page Un-Published', {context: 'un_publish_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.delete('/:domainId/:pageId/delete_page', auth.can('edit domain'), function(req, res) {
  models.Page.deletePage(req, { domain_id: req.params.domainId, id: req.params.pageId }, function (error) {
    if (error) {
      log.error('Could not delete page for admin for domain', { err: error, context: 'delete_page', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Commuity Page Published', {context: 'delete_page', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.post('/:domainId/news_story', auth.isLoggedIn, auth.can('view domain'), function(req, res) {
  models.Point.createNewsStory(req, req.body, function (error) {
    if (error) {
      log.error('Could not save news story point on domain', { err: error, context: 'news_story', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else {
      log.info('Point News Story Created', {context: 'news_story', user: toJson(req.user.simple()) });
      res.sendStatus(200);
    }
  });
});

router.get('/', function(req, res) {
  getDomain(req, req.ypDomain.id, function (error, domain) {
    if (error) {
      if (error=='Not found')
        sendDomainOrError(res, null, 'view', req.user, error, 404);
      else
        sendDomainOrError(res, null, 'view', req.user, error);
    } else {
      if (req.ypCommunity && req.ypCommunity.id) {
        log.info('Domain Lookup Found Community', { community: req.ypCommunity.hostname, context: 'index', user: toJson(req.user) });
        res.send({community: req.ypCommunity, domain: domain});
      } else {
        log.info('Domain Lookup Found Domain', { domain: toJson(domain.simple()), context: 'index', user: toJson(req.user) });
        res.send({domain: domain})
      }
    }
  });
});

router.get('/:id/translatedText', auth.can('view domain'), function(req, res) {
  if (req.query.textType.indexOf("domain") > -1) {
    models.Domain.find({
      where: {
        id: req.params.id
      },
      attributes: ['id','name','description']
    }).then(function(domain) {
      if (domain) {
        models.TranslationCache.getTranslation(req, domain, function (error, translation) {
          if (error) {
            sendDomainOrError(res, req.params.id, 'translated', req.user, error, 500);
          } else {
            res.send(translation);
          }
        });
        log.info('Domain translatedTitle', {  context: 'translated' });
      } else {
        sendDomainOrError(res, req.params.id, 'translated', req.user, 'Not found', 404);
      }
    }).catch(function(error) {
      sendDomainOrError(res, null, 'translated', req.user, error);
    });
  } else {
    sendDomainOrError(res, req.params.id, 'translated', req.user, 'Wrong textType', 401);
  }
});

router.get('/:id', auth.can('view domain'), function(req, res) {
  getDomain(req, req.params.id, function (error, domain) {
    if (error) {
      sendDomainOrError(res, null, 'view', req.user, error);
    } else {
      log.info('Domain Viewed', { domain: toJson(domain.simple()), context: 'index', user: req.user ? req.user.email : null });
      res.send(domain);
    }
  });
});

router.put('/:id', auth.can('edit domain'), function(req, res) {
  models.Domain.find({
    where: { id: req.params.id }
  }).then(function(domain) {
    if (domain) {
      domain.ensureApiKeySetup();
      domain.set('secret_api_keys.facebook.client_id', req.body.facebookClientId);
      domain.set('secret_api_keys.facebook.client_secret', req.body.facebookClientSecret);
      domain.set('secret_api_keys.google.client_id', req.body.googleClientId);
      domain.set('secret_api_keys.google.client_secret', req.body.googleClientSecret);
      domain.set('secret_api_keys.twitter.client_id', req.body.twitterClientId);
      domain.set('secret_api_keys.twitter.client_secret', req.body.twitterClientSecret);
      domain.set('secret_api_keys.github.client_id', req.body.githubClientId);
      domain.set('secret_api_keys.github.client_secret', req.body.githubClientSecret);
      if (req.body.samlEntryPoint) {
        domain.set('secret_api_keys.saml.entryPoint', req.body.samlEntryPoint);
        domain.set('secret_api_keys.saml.callbackUrl', req.body.samlCallbackUrl);
        domain.set('secret_api_keys.saml.cert', req.body.samlCert);
      }

      if (!domain.configuration) {
        domain.set('configuration', {});
      }

      domain.set('configuration.customUserRegistrationText', (req.body.customUserRegistrationText && req.body.customUserRegistrationText!="") ? req.body.customUserRegistrationText : null);
      domain.set('configuration.downloadFacebookImagesForUser', (req.body.downloadFacebookImagesForUser && req.body.downloadFacebookImagesForUser!="") ? true : false);
      domain.set('configuration.disableNameAutoTranslation', (req.body.disableNameAutoTranslation && req.body.disableNameAutoTranslation!="") ? true : false);

      if (req.body.appHomeScreenIconImageId && req.body.appHomeScreenIconImageId!="") {
        domain.set('configuration.appHomeScreenIconImageId', req.body.appHomeScreenIconImageId);
      }

      domain.set('configuration.appHomeScreenShortName', (req.body.appHomeScreenShortName && req.body.appHomeScreenShortName!="")? req.body.appHomeScreenShortName : null);
      domain.set('configuration.useVideoCover', truthValueFromBody(req.body.useVideoCover));

      domain.name = req.body.name;
      domain.description = req.body.description;
      domain.only_admins_can_create_communities = req.body.onlyAdminsCanCreateCommunities ? true : false;
      domain.theme_id = req.body.themeId ? parseInt(req.body.themeId) : null;
      if (req.body.defaultLocale && req.body.defaultLocale!="") {
        domain.default_locale = req.body.defaultLocale;
      }
      domain.save().then(function () {
        log.info('Domain Updated', { domain: toJson(domain), user: toJson(req.user) });
        domain.setupImages(req.body, function(err) {
          if (err) {
            res.sendStatus(500);
            log.error('Domain Error Setup images', { domain: toJson(domain), user: toJson(req.user), err: err });
          } else {
            res.send(domain);
          }
        });
      });
    } else {
      sendDomainOrError(res, req.params.id, 'update', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendDomainOrError(res, null, 'update', req.user, error);
  });
});

router.delete('/:id', auth.can('edit domain'), function(req, res) {
  models.Domain.find({
    where: {id: req.params.id}
  }).then(function (domain) {
    if (domain) {
      domain.deleted = true;
      domain.save().then(function () {
        log.info('Domain Deleted', { group: toJson(group), context: 'delete', user: toJson(req.user) });
        res.sendStatus(200);
      });
    } else {
      sendDomainOrError(res, req.params.id, 'delete', req.user, 'Not found', 404);
    }
  }).catch(function(error) {
    sendDomainOrError(res, null, 'delete', req.user, error);
  });
});

router.get(':id/news', auth.can('view domain'), function(req, res) {
  models.AcActivity.find({
    where: { domain_id: req.params.id },
    order: [
      [ { model: models.Domain } ,'created_at', 'asc' ]
    ],
    limit: 200
  }).then(function(news) {
    if (news) {
      log.info('Domain News', { domain: toJson(news), context: 'get', user: toJson(req.user) });
      res.send(news);
    } else {
      log.warn("Domain News Not Found", {
        context: context, domain: toJson(domain), user: toJson(user), err: "Not found",
        errorStatus: errorStatus ? errorStatus : 404
      });
      res.sendStatus(404);
    }
  }).catch(function(error) {
    log.error("Domain News Error", { context: context, domain: toJson(domain), user: toJson(user), err: error,
      errorStatus: errorStatus ? errorStatus : 500 });
    res.sendStatus(500);
  });
});

router.delete('/:domainId/remove_many_admins', auth.can('edit domain'), (req, res) => {
  queue.create('process-deletion', { type: 'remove-many-domain-admins', userIds: req.body.userIds, domainId: req.params.domainId }).
  priority('high').removeOnComplete(true).save();
  log.info('Remove many domain admins started', { context: 'remove_many_admins', domainId: req.params.domainId, user: toJson(req.user.simple()) });
  res.sendStatus(200);
});

router.delete('/:domainId/remove_many_users_and_delete_content', auth.can('edit domain'), function(req, res) {
  queue.create('process-deletion', { type: 'remove-many-domain-users-and-delete-content', userIds: req.body.userIds, domainId: req.params.domainId }).
  priority('high').removeOnComplete(true).save();
  log.info('Remove many and delete many domain users content', { context: 'remove_many_users_and_delete_content', domainId: req.params.domainId, user: toJson(req.user.simple()) });
  res.sendStatus(200);
});

router.delete('/:domainId/remove_many_users', auth.can('edit domain'), function(req, res) {
  queue.create('process-deletion', { type: 'remove-many-domain-users', userIds: req.body.userIds, domainId: req.params.domainId }).
  priority('high').removeOnComplete(true).save();
  log.info('Remove many domain admins started', { context: 'remove_many_users', domainId: req.params.domainId, user: toJson(req.user.simple()) });
  res.sendStatus(200);
});

router.delete('/:domainId/:userId/remove_and_delete_user_content', auth.can('edit domain'), function(req, res) {
  getDomainAndUser(req.params.domainId, req.params.userId, null, function (error, domain, user) {
    if (error) {
      log.error('Could not remove_user', { err: error, domainId: req.params.domainId, userRemovedId: req.params.userId, context: 'remove_user', user: toJson(req.user.simple()) });
      res.sendStatus(500);
    } else if (user && domain) {
      domain.removeDomainUsers(user).then(function (results) {
        queue.create('process-deletion', { type: 'delete-domain-user-content', userId: req.params.userId, domainId: req.params.domainId }).
        priority('high').removeOnComplete(true).save();
        log.info('User removed from domain', {context: 'remove_and_delete_user_content', domainId: req.params.domainId, userRemovedId: req.params.userId, user: toJson(req.user.simple()) });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.delete('/:domainId/:userId/remove_admin', auth.can('edit domain'), function(req, res) {
  getDomainAndUser(req.params.domainId, req.params.userId, null, function (error, domain, user) {
    if (error) {
      log.error('Could not remove admin', { err: error, domainId: req.params.domainId, userRemovedId: req.params.userId, context: 'remove_admin', user: req.user ? toJson(req.user.simple()) : null });
      res.sendStatus(500);
    } else if (user && domain) {
      domain.removeDomainAdmins(user).then(function (results) {
        log.info('Admin removed', {context: 'remove_admin', domainId: req.params.domainId, userRemovedId: req.params.userId, user: req.user ? toJson(req.user.simple()) : null });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.post('/:domainId/:email/add_admin', auth.can('edit domain'), function(req, res) {
  getDomainAndUser(req.params.domainId, null, req.params.email, function (error, domain, user) {
    if (error) {
      log.error('Could not add admin', { err: error, domainId: req.params.domainId, userAddEmail: req.params.email, context: 'remove_admin', user: req.user ? toJson(req.user.simple()) : null });
      res.sendStatus(500);
    } else if (user && domain) {
      domain.addDomainAdmins(user).then(function (results) {
        log.info('Admin Added', {context: 'add_admin', domainId: req.params.domainId, userAddEmail: req.params.email, user: req.user ? toJson(req.user.simple()) : null });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

router.delete('/:domainId/:userId/remove_user', auth.can('edit domain'), function(req, res) {
  getDomainAndUser(req.params.domainId, req.params.userId, null, function (error, domain, user) {
    if (error) {
      log.error('Could not remove_user', { err: error, domainId: req.params.domainId, userRemovedId: req.params.userId, context: 'remove_user', user: req.user ? toJson(req.user.simple()) : null });
      res.sendStatus(500);
    } else if (user && domain) {
      domain.removeDomainUsers(user).then(function (results) {
        if (domain.counter_users > 0) {
          domain.decrement("counter_users")
        }
        log.info('User removed', {context: 'remove_user', domainId: req.params.domainId, userRemovedId: req.params.userId, user: req.user ? toJson(req.user.simple()) : null });
        res.sendStatus(200);
      });
    } else {
      res.sendStatus(404);
    }
  });
});

module.exports = router;
