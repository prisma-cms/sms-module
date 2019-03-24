
import fs from "fs";

import chalk from "chalk";

import SmsMessageModule from "./SmsMessage";
import SmsProviderModule from "./SmsProvider";

// import LogModule from "@prisma-cms/log-module";
// import UserModule from "@prisma-cms/user-module";

import PrismaModule from "@prisma-cms/prisma-module";

import MergeSchema from 'merge-graphql-schemas';

import path from 'path';

const moduleURL = new URL(import.meta.url);

const __dirname = path.dirname(moduleURL.pathname);

const { createWriteStream, unlinkSync } = fs;

const { fileLoader, mergeTypes } = MergeSchema

class Module extends PrismaModule {


  constructor(props = {}) {

    super(props);

    Object.assign(this, {
    });

    this.mergeModules([
      // LogModule,
      // UserModule,
      SmsMessageModule,
      SmsProviderModule,
    ]);

  }


  getSchema(types = []) {


    let schema = fileLoader(__dirname + '/schema/database/', {
      recursive: true,
    });


    if (schema) {
      types = types.concat(schema);
    }


    let typesArray = super.getSchema(types);

    return typesArray;

  }


  getApiSchema(types = []) {


    let baseSchema = [];

    let schemaFile = __dirname + "/../schema/generated/prisma.graphql";

    if (fs.existsSync(schemaFile)) {
      baseSchema = fs.readFileSync(schemaFile, "utf-8");
    }

    let apiSchema = super.getApiSchema(types.concat(baseSchema), []);

    let schema = fileLoader(__dirname + '/schema/api/', {
      recursive: true,
    });

    apiSchema = mergeTypes([apiSchema.concat(schema)], { all: true });


    return apiSchema;

  }


  getResolvers() {

    const resolvers = super.getResolvers();

    // console.log("getResolvers resolvers", resolvers);

    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      SmsMessage: {
        from: () => "",
        text: () => "",
        recipients: () => [],
        // Provider: () => null,
        CreatedBy: () => null,
      },
      SmsProvider: {
        credentials: () => null,
      },
    });

    return resolvers;
  }


}


export default Module;