

import PrismaProcessor from "@prisma-cms/prisma-processor";
import PrismaModule from "@prisma-cms/prisma-module";

import chalk from "chalk";

import xml2js from "xml2js";

const {
  parseString: xmlParser,
  Builder: xmlBuilder,
} = xml2js;


class SmsMessageProcessor extends PrismaProcessor {


  constructor(props) {

    super(props);

    this.objectType = "SmsMessage";

    this.private = false;

    this.maxLength = 100;

  }


  async create(objectType, args, info) {


    const {
      id: currentUserId,
      sudo,
    } = await this.getUser() || {};


    if (sudo !== true) {
      return this.addError("Access denied");
    }

    return this.createAndSendSms(objectType, args, info);
  }


  async createAndSendSms(objectType, args, info) {

    const {
      maxLength,
    } = this;

    const {
      db,
    } = this.ctx;

    const {
      id: currentUserId,
    } = await this.getUser() || {};


    let {
      data: {
        ...data
      },
    } = args;


    let {
      recipients,
      text,
    } = data;

    text = text.trim();

    let {
      set: recipientsSet,
    } = recipients || {};

    recipientsSet = recipientsSet && recipientsSet.map(n => n && n.trim().replace(/[^0-9]/g, '')).filter(n => n) || [];

    if (!recipientsSet.length) {
      this.addFieldError("recipients", "Не были указаны получатели");
    }
    else {
      recipients.set = recipientsSet;
    }


    if (!text) {
      this.addFieldError("text", "Не заполнено сообщение");
    }
    else if (maxLength && text.length > maxLength) {
      this.addFieldError("text", `Сообщение не должно превышать ${maxLength} символов`);
    }


    if (currentUserId) {
      Object.assign(data, {
        CreatedBy: {
          connect: {
            id: currentUserId,
          },
        },
      });
    }


    args = Object.assign(args, {
      data,
    });

    let sms = await super.create(objectType, args, info);

    /**
     * Если смс было создано, отправляем сообщение
     */
    if (sms) {

      const {
        id: smsId,
        deletOnSend,
      } = sms;

      await this.sendSms(null, {
        where: {
          id: smsId,
        },
      })
        .catch(console.error);

      if (deletOnSend) {

        await db.mutation.deleteSmsMessage({
          where: {
            id: smsId,
          },
        })
          .catch(error => {

            // console.error(error);

            this.error(error);

          });

      }

    }

    return sms;

  }


  mutate(method, args, info) {

    const {
      currentUser,
    } = this.ctx

    let {
      data: {
        ...data
      },
    } = args;

    const {
      sudo,
    } = currentUser || {}

    // if (!sudo) {
    //   throw new Error("Access denied");
    // }


    // if (login !== undefined) {

    //   login = login && login.trim() || null;

    //   if (!login) {
    //     this.addFieldError("login", "Не указан логин");
    //   }

    // }


    Object.assign(args, {
      data: {
        ...data,
      },
    });


    return super.mutate(method, args);

  }


  /**
   * Отправка сообщения
   */
  async sendSms(source, args, info) {

    const {
      ctx,
    } = this;

    const {
      db,
    } = ctx;

    let {
      where,
    } = args;

    let result;


    const schema = `
      {
        id
        from
        text
        recipients
        Provider{
          id
          credentials
        }
        Status{
          id
          name
          description
        }
      }
    `;

    const sms = await db.query.smsMessage({
      where,
    }, schema);


    if (sms) {

      const {
        id: smsId,
        from,
        text,
        recipients,
        Provider: {
          id: providerId,
          credentials: {
            username: login,
            password,
          },
        },
        Status: currentStatus,
      } = sms;

      if (currentStatus) {
        throw new Error("Сообщение уже было отправлено");
      }

      if (!login || !password) {
        throw new Error("Не были получены данные отправителя");
      }

      if (!recipients || !recipients.length) {
        throw new Error("Не были получены данные получателей");
      }


      let obj = {
        request: {
          auth: {
            login,
            password,
          },
          message: {
            from,
            text,
            recipient: recipients,
          },
        },
      }

      var builder = new xmlBuilder();
      var XML = builder.buildObject(obj);

      // console.log(chalk.green("XML"), XML.toString());



      let requestResult = await fetch('https://letsads.com/api', {
        method: 'POST',
        // mode: 'no-cors',
        headers: new Headers(
          {
            'Content-Type': 'text/xml; charset=utf-8',
            // 'Accept': '*/*',
            // 'Accept-Language': 'en-GB',
            // 'Accept-Encoding': 'gzip, deflate',
            // 'Connection': 'Keep-alive',
            // 'Content-Length': Content.length
          }),
        body: XML.toString(),
      })
        .then(r => {

          return r.text();
        })
        .catch(error => {

          console.log(chalk.red("requestResult error"), error);

          this.error(error);
        });

      // let requestResult = `<?xml version="1.0" encoding="UTF-8"?>
      //    <response><name>Error</name><description>REQUEST_FORMAT</description></response>
      // `;

      // let requestResult = `<?xml version="1.0" encoding="UTF-8"?>
      //   <response><name>Complete</name><description>1 message put into queue</description><sms_id>7777777</sms_id></response>
      // `;

      // console.log(chalk.green("requestResult"), requestResult);

      let requestResultXml = requestResult && xmlParser(requestResult, (err, result) => {
        console.log(chalk.green("xmlParser requestResultXml"), err, result);
      }) || {};


      xmlParser(requestResult, (err, result) => {
        console.log(chalk.green("xmlParser requestResultXml"), err, result);

        if (err) {
          throw err;
        }

        requestResultXml = result;

      }) || {};

      // let requestResultXml = requestResult && await xmlParser(requestResult) || {};

      console.log(chalk.green("requestResultXml"), requestResultXml);

      const {
        response,
      } = requestResultXml || {};


      if (!response) {

        let error = new Error("Не был получен ответ от шлюза");

        this.error(error);

        // throw error;
      }

      let {
        name,
        description,
        sms_id,
      } = response || {};


      name = name && name[0] || "Error"
      description = description && description[0] || ""


      // console.log(chalk.green("requestResultXml name"), name);
      // console.log(chalk.green("requestResultXml description"), description);


      let errorCode;

      if (name === "Error") {
        errorCode = description;
        description = null;

        this.error({
          objectType: this.objectType,
          message: "Error sending sms",
          stack: JSON.stringify(requestResultXml),
        });
      }


      let create = sms_id ? sms_id.map(n => {

        let sms_id = (n && parseInt(n)) || null;

        return sms_id ? {
          sms_id,
        } : null;
      }).filter(n => n) : []


      let Status = {
        create: {
          name,
          description,
          errorCode,
          // sms_id: {
          //   set: sms_id || [],
          // },
          Items: {
            create,
          },
        },
      }

      await db.mutation.updateSmsMessage({
        where,
        data: {
          Status,
        },
      });

    }
    else {
      throw new Error("Не было получено sms");
    }

    return result;
  }

}




class Module extends PrismaModule {


  constructor(props = {}) {

    super(props);

    // this.mergeModules([ 
    // ]);


    this.SmsMessageResponse = {
      data: (source, args, ctx, info) => {

        const {
          id,
        } = source && source.data || {};

        return id ? ctx.db.query.smsMessage({
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
        // smsMessage: this.smsMessage.bind(this),
        // smsMessages: this.smsMessages.bind(this),
        // smsMessagesConnection: this.smsMessagesConnection.bind(this),
      },
      Mutation: {
        createSmsMessageProcessor: this.createSmsMessageProcessor.bind(this),
        // updateSmsMessageProcessor: this.updateSmsMessageProcessor.bind(this),
        // deleteSmsMessage: this.deleteSmsMessage.bind(this),
        // deleteManySmsMessages: this.deleteManySmsMessages.bind(this),
      },
      Subscription: {
        // smsMessage: {
        //   subscribe: async (parent, args, ctx, info) => {

        //     return ctx.db.subscription.smsMessage(args, info)
        //   },
        // },
      },
      SmsMessageResponse: this.SmsMessageResponse,
    }

  }


  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }

  getProcessorClass() {
    return SmsMessageProcessor;
  }


  smsMessages(source, args, ctx, info) {
    return ctx.db.query.smsMessages({}, info);
  }

  smsMessage(source, args, ctx, info) {
    return ctx.db.query.smsMessage({}, info);
  }

  smsMessagesConnection(source, args, ctx, info) {

    let {
      where: argsWhere,
    } = args;

    const {
      currentUser,
    } = ctx;

    const {
      id: currentUserId,
    } = currentUser || {};

    let AND = []


    if (!currentUserId) {

      AND.push({
        id: "-null",
      });

    }
    else {

      if (argsWhere) {
        AND.push(argsWhere);
      }

      AND.push({
        CreatedBy: {
          id: currentUserId,
        },
      });

    }

    let where = {
      AND,
    }

    Object.assign(args, {
      where,
    });

    return ctx.db.query.smsMessagesConnection(args, info);
  }


  createSmsMessageProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("SmsMessage", args, info);
  }

  updateSmsMessageProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("SmsMessage", args, info);
  }


  deleteSmsMessage(source, args, ctx, info) {
    return ctx.db.mutation.deleteSmsMessage({}, info);
  }


  deleteManySmsMessages(source, args, ctx, info) {
    return ctx.db.mutation.deleteManySmsMessages({}, info);
  }

}


export default Module;
