

import PrismaProcessor from "@prisma-cms/prisma-processor";
import PrismaModule from "@prisma-cms/prisma-module";

import chalk from "chalk";


class SmsProviderProcessor extends PrismaProcessor {


  constructor(props) {

    super(props);

    this.objectType = "SmsProvider";

    this.private = true;

  }


  async create(objectType, args, info) {


    let {
      data: {
        ...data
      },
      ...otherArgs
    } = args;


    const {
      id: currentUserId,
    } = await this.getUser(true);


    Object.assign(data, {
      CreatedBy: {
        connect: {
          id: currentUserId,
        },
      },
    });

    return super.create(objectType, {
      data,
      ...otherArgs,
    }, info);

  }


  async mutate(objectType, args, into) {

    return super.mutate(objectType, args);
  }

}




class Module extends PrismaModule {


  constructor(props = {}) {

    super(props);

    // this.mergeModules([ 
    // ]);


    this.SmsProviderResponse = {
      data: (source, args, ctx, info) => {

        const {
          id,
        } = source && source.data || {};

        return id ? ctx.db.query.smsProvider({
          where: {
            id,
          },
        }, info) : null;

      },
    }

  }



  getResolvers() {

    return {
      Query: {
        smsProvider: this.smsProvider.bind(this),
        smsProviders: this.smsProviders.bind(this),
        smsProvidersConnection: this.smsProvidersConnection.bind(this),
      },
      Mutation: {
        createSmsProviderProcessor: this.createSmsProviderProcessor.bind(this),
        updateSmsProviderProcessor: this.updateSmsProviderProcessor.bind(this),
        deleteSmsProvider: this.deleteSmsProvider.bind(this),
        deleteManySmsProviders: this.deleteManySmsProviders.bind(this),
      },
      Subscription: {
        smsProvider: {
          subscribe: async (parent, args, ctx, info) => {

            return ctx.db.subscription.smsProvider(args, info)
          },
        },
      },
      SmsProviderResponse: this.SmsProviderResponse,
    }

  }


  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }

  getProcessorClass() {
    return SmsProviderProcessor;
  }


  smsProviders(source, args, ctx, info) {
    return ctx.db.query.smsProviders({}, info);
  }

  smsProvider(source, args, ctx, info) {
    return ctx.db.query.smsProvider({}, info);
  }

  smsProvidersConnection(source, args, ctx, info) {
    return ctx.db.query.smsProvidersConnection({}, info);
  }


  createSmsProviderProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("SmsProvider", args, info);
  }

  updateSmsProviderProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("SmsProvider", args, info);
  }


  deleteSmsProvider(source, args, ctx, info) {
    return ctx.db.mutation.deleteSmsProvider({}, info);
  }


  deleteManySmsProviders(source, args, ctx, info) {
    return ctx.db.mutation.deleteManySmsProviders({}, info);
  }

}


export default Module;
