import React from 'react'
import ReactDOM from 'react-dom/server'
import ApolloClient, { createNetworkInterface, addTypename } from 'apollo-client'
import { ApolloProvider } from 'react-apollo'
import { getDataFromTree } from 'react-apollo/server'
import { match, RouterContext } from 'react-router'
import { StyleSheetServer } from 'aphrodite'
import fs from 'fs'
import path from 'path'

import Html from '../../ui/components/html'
import routes from '../../routes'
import log from '../../log'
import { app as settings } from '../../../package.json'

const port = process.env.PORT || settings.apiPort;

const apiUrl = `http://localhost:${port}/graphql`;

var assetMap;

export default (req, res) => {
  match({ routes, location: req.originalUrl }, (error, redirectLocation, renderProps) => {
    if (redirectLocation) {
      res.redirect(redirectLocation.pathname + redirectLocation.search);
    } else if (error) {
      log.error('ROUTER ERROR:', error);
      res.status(500);
    } else if (renderProps) {
      const client = new ApolloClient({
        ssrMode: true,
        queryTransformer: addTypename,
        dataIdFromObject: (result) => {
          if (result.id && result.__typename) { // eslint-disable-line no-underscore-dangle
            return result.__typename + result.id; // eslint-disable-line no-underscore-dangle
          }
          return null;
        },
        networkInterface: createNetworkInterface(apiUrl, {
          credentials: 'same-origin',
          headers: req.headers,
        }),
      });

      const component = (
        <ApolloProvider client={client}>
          <RouterContext {...renderProps} />
        </ApolloProvider>
      );

      StyleSheetServer.renderStatic(() => getDataFromTree(component).then(context => {
        res.status(200);

        const { html, css } = StyleSheetServer.renderStatic(() => ReactDOM.renderToString(component));

        if (__DEV__ || !assetMap) {
          assetMap = JSON.parse(fs.readFileSync(path.join(settings.frontendBuildDir, 'assets.json')));
        }

        const page = <Html content={html} state={context.store.getState()} assetMap={assetMap} aphroditeCss={css}/>;
        res.send(`<!doctype html>\n${ReactDOM.renderToStaticMarkup(page)}`);
        res.end();
      }).catch(e => log.error('RENDERING ERROR:', e)));
    } else {
      res.status(404).send('Not found');
    }
  });
};