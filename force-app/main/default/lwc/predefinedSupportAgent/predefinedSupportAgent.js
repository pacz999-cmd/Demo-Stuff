import { LightningElement } from 'lwc';

const IMAGE_URL =
    'https://trailsignup-588a3d08496c77--c.vf.force.com/resource/1778592801000/robot';
const PRODUCT_URL =
    'https://trailsignup-588a3d08496c77.my.site.com/b2benhanced/product/iiqka-education-vp-cell/01tg700000DqNnRAAV';

const ACCOUNT_UPDATE_RESPONSE =
    'Hi, Lauren since your last login on May 19th there were the following changes to your account:<br/><br/>' +
    'There are <b>2 new invoices</b> available in the <b>Invoices</b> section.<br/><br/>' +
    'There is <b>1 quote</b> that needs your approval. Please check in the <b>Quotes</b> section.<br/><br/>' +
    'There is a <b>new budget</b> allocated to one of your co-workers in the <b>Team</b> section.<br/><br/>' +
    'One of your subscriptions is due for renewal. Please check the <b>Subscriptions</b> section.';

const TRAINING_ROBOT_RESPONSE =
    'Sure, Kuka offers a variety of robots for education purposes.<br/><br/>' +
    'The <i>iiQKA Education vp Cell</i> is a modular training cell, prepared for installation of the optional vision package for practical performance of basic training, programming training, and application training using a KUKA KR 4 AGILUS industrial robot and a corresponding electric gripper.<br/><br/>' +
    'All components are already assembled, installed and configured. The training cell comes with an EU declaration of conformity, as well as cTUVus and CE markings.<br/><br/>' +
    'You can view it here:';

const FALLBACK_RESPONSE =
    'I can help with account updates and education/training robot availability. Please ask one of those topics.';

export default class PredefinedSupportAgent extends LightningElement {
    inputValue = '';
    messages = [];
    messageCounter = 0;
    timeoutIds = [];
    isAwaitingResponse = false;

    disconnectedCallback() {
        this.timeoutIds.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.timeoutIds = [];
        this.isAwaitingResponse = false;
    }

    handleInputChange(event) {
        this.inputValue = event.target.value;
    }

    handleSend() {
        const text = (this.inputValue || '').trim();
        if (!text || this.isAwaitingResponse) {
            return;
        }

        this.isAwaitingResponse = true;
        this.pushMessage(text, true);
        const thinkingMessageId = this.pushThinkingMessage();
        const timeoutId = setTimeout(() => {
            const response = this.getAgentResponse(text);
            this.replaceMessage(thinkingMessageId, response, false, this.isTrainingRobotQuestion(text.toLowerCase()));
            this.isAwaitingResponse = false;
        }, 3000);
        this.timeoutIds = [...this.timeoutIds, timeoutId];
        this.inputValue = '';
    }

    get isSendDisabled() {
        return this.isAwaitingResponse || !(this.inputValue || '').trim();
    }

    getAgentResponse(userInput) {
        const normalized = userInput.toLowerCase();

        if (this.isAccountUpdateQuestion(normalized)) {
            return ACCOUNT_UPDATE_RESPONSE;
        }

        if (this.isTrainingRobotQuestion(normalized)) {
            return TRAINING_ROBOT_RESPONSE;
        }

        return FALLBACK_RESPONSE;
    }

    isAccountUpdateQuestion(text) {
        const asksRecent =
            text.includes('recent') ||
            text.includes('latest') ||
            text.includes('last login') ||
            text.includes('update');
        const asksAccount = text.includes('my account') || text.includes('account section') || text.includes('account');
        return asksRecent && asksAccount;
    }

    isTrainingRobotQuestion(text) {
        const hasRobot = text.includes('robot') || text.includes('robots');
        const hasTrainingIntent =
            text.includes('training') ||
            text.includes('education') ||
            text.includes('educational') ||
            text.includes('for school');
        const asksSales = text.includes('sell') || text.includes('sold') || text.includes('offer');
        return hasRobot && hasTrainingIntent && asksSales;
    }

    pushMessage(text, isUser) {
        this.messageCounter += 1;
        const className = isUser ? 'message user' : 'message agent';
        this.messages = [...this.messages, { id: this.messageCounter, text, isUser, className }];
        return this.messageCounter;
    }

    pushThinkingMessage() {
        this.messageCounter += 1;
        this.messages = [
            ...this.messages,
            {
                id: this.messageCounter,
                text: '',
                isUser: false,
                isThinking: true,
                className: 'message agent'
            }
        ];
        return this.messageCounter;
    }

    replaceMessage(messageId, text, isUser, isProductResponse) {
        const className = isUser ? 'message user' : 'message agent';
        this.messages = this.messages.map((message) => {
            if (message.id !== messageId) {
                return message;
            }

            return {
                id: message.id,
                text,
                isUser,
                isThinking: false,
                isProductResponse: !!isProductResponse,
                productUrl: isProductResponse ? PRODUCT_URL : '',
                imageUrl: isProductResponse ? IMAGE_URL : '',
                className
            };
        });
    }

    handleProductClick(event) {
        event.preventDefault();
        const url = event.currentTarget.dataset.url;
        if (url) {
            window.open(url, '_blank');
        }
    }
}
