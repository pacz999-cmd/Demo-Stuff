import { LightningElement, api, wire } from 'lwc';
import siteId from '@salesforce/site/Id';
import basePath from '@salesforce/community/basePath';
import { getContent } from 'experience/cmsDeliveryApi';

const DEFAULT_SECONDS = 4;

export default class CarouselBanner extends LightningElement {
    @api banner1Name = 'New feature';
    @api banner1Subtitle = 'Discover updates and improvements.';
    @api banner1CtaLabel = 'Learn more';
    @api banner1CtaUrl = '#';
    @api banner1Image;
    @api banner2Name = 'Spare parts discount';
    @api banner2Subtitle =
        '*Free standard delivery with no minimum order value and prioritized order processing for online spare parts orders.';
    @api banner2CtaLabel = 'Order now!';
    @api banner2CtaUrl = '#';
    @api banner2Image;
    @api banner3Name = 'iiQWorks';
    @api banner3Subtitle = 'Plan and automate your production workflows.';
    @api banner3CtaLabel = 'Explore';
    @api banner3CtaUrl = '#';
    @api banner3Image;
    @api banner4Name = 'Mobile robotics';
    @api banner4Subtitle = 'Boost efficiency with connected mobile robots.';
    @api banner4CtaLabel = 'Get started';
    @api banner4CtaUrl = '#';
    @api banner4Image;
    @api rotationSeconds = DEFAULT_SECONDS;
    @api bannerHeight = 320;
    @api showDebug = false;

    currentIndex = 0;
    timerId;
    cmsImageUrlByKey = {};
    currentImageAttemptIndex = 0;
    lastWireError;

    connectedCallback() {
        this.startAutoplay();
    }

    disconnectedCallback() {
        this.clearAutoplay();
    }

    get slides() {
        const rawSlides = [
            {
                index: 0,
                name: this.banner1Name,
                subtitle: this.banner1Subtitle,
                ctaLabel: this.banner1CtaLabel,
                ctaUrl: this.banner1CtaUrl,
                image: this.banner1Image
            },
            {
                index: 1,
                name: this.banner2Name,
                subtitle: this.banner2Subtitle,
                ctaLabel: this.banner2CtaLabel,
                ctaUrl: this.banner2CtaUrl,
                image: this.banner2Image
            },
            {
                index: 2,
                name: this.banner3Name,
                subtitle: this.banner3Subtitle,
                ctaLabel: this.banner3CtaLabel,
                ctaUrl: this.banner3CtaUrl,
                image: this.banner3Image
            },
            {
                index: 3,
                name: this.banner4Name,
                subtitle: this.banner4Subtitle,
                ctaLabel: this.banner4CtaLabel,
                ctaUrl: this.banner4CtaUrl,
                image: this.banner4Image
            }
        ];

        return rawSlides.map((slide) => ({
            ...slide,
            name: slide.name || `Banner ${slide.index + 1}`,
            subtitle: slide.subtitle || '',
            ctaLabel: slide.ctaLabel || '',
            ctaUrl: slide.ctaUrl || '#',
            tabClass: slide.index === this.currentIndex ? 'tab active' : 'tab',
            isActive: slide.index === this.currentIndex
        }));
    }

    get currentSlide() {
        return this.slides[this.currentIndex] || this.slides[0];
    }

    get currentImageUrl() {
        const candidates = this.currentImageCandidates;
        return candidates[this.currentImageAttemptIndex] || '';
    }

    get currentImageCandidates() {
        return this.resolveImageCandidates(this.currentSlide?.image);
    }

    get carouselClass() {
        return this.currentImageUrl ? 'carousel has-image' : 'carousel no-image';
    }

    get carouselStyle() {
        const height = Number(this.bannerHeight);
        const normalizedHeight = Number.isNaN(height) ? 320 : Math.min(Math.max(height, 200), 900);
        return `height: ${normalizedHeight}px;`;
    }

    get currentContentKey() {
        const resolved = this.resolveCmsReference(this.currentSlide?.image);
        return resolved.contentKey || undefined;
    }

    @wire(getContent, {
        channelOrSiteId: siteId,
        contentKeyOrId: '$currentContentKey'
    })
    wiredManagedContent({ data, error }) {
        if (error) {
            this.lastWireError = JSON.stringify(error);
            return;
        }

        this.lastWireError = '';
        if (!data || !this.currentContentKey) {
            return;
        }

        const extractedUrl = this.extractCmsImageUrl(data);
        if (!extractedUrl) {
            return;
        }

        this.cmsImageUrlByKey = {
            ...this.cmsImageUrlByKey,
            [this.currentContentKey]: extractedUrl
        };
        this.currentImageAttemptIndex = 0;
    }

    handleTabClick(event) {
        const index = Number(event.currentTarget.dataset.index);
        if (Number.isNaN(index) || index === this.currentIndex) {
            return;
        }

        this.currentIndex = index;
        this.currentImageAttemptIndex = 0;
        this.startAutoplay();
    }

    startAutoplay() {
        this.clearAutoplay();
        const delayMs = this.getDelayInMs();

        this.timerId = setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % this.slides.length;
            this.currentImageAttemptIndex = 0;
        }, delayMs);
    }

    clearAutoplay() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    getDelayInMs() {
        const seconds = Number(this.rotationSeconds);
        if (Number.isNaN(seconds) || seconds <= 0) {
            return DEFAULT_SECONDS * 1000;
        }

        return seconds * 1000;
    }

    resolveImageCandidates(imageValue) {
        const resolved = this.resolveCmsReference(imageValue);
        if (resolved.directUrl) {
            return [resolved.directUrl];
        }

        if (resolved.contentKey) {
            const fromWire = this.cmsImageUrlByKey[resolved.contentKey];
            const fallbackUrls = this.buildFallbackMediaUrls(resolved.contentKey);

            return [fromWire, ...fallbackUrls].filter((value, idx, arr) => {
                if (!value) {
                    return false;
                }

                return arr.indexOf(value) === idx;
            });
        }

        return [];
    }

    resolveCmsReference(imageValue) {
        if (!imageValue) {
            return { directUrl: '', contentKey: '' };
        }

        if (typeof imageValue === 'string') {
            const trimmed = imageValue.trim();
            if (!trimmed) {
                return { directUrl: '', contentKey: '' };
            }

            if (!trimmed.startsWith('{')) {
                return this.toDirectUrlOrKey(trimmed);
            }

            try {
                const parsed = JSON.parse(trimmed);
                return this.resolveCmsReference(parsed);
            } catch (error) {
                return { directUrl: '', contentKey: '' };
            }
        }

        if (typeof imageValue === 'object') {
            const candidate =
                imageValue.url ||
                imageValue.unauthenticatedUrl ||
                imageValue.fileUrl ||
                imageValue.contentUrl ||
                imageValue.publicUrl ||
                imageValue.contentKey ||
                imageValue.id ||
                '';
            return this.toDirectUrlOrKey(candidate);
        }

        return { directUrl: '', contentKey: '' };
    }

    toDirectUrlOrKey(candidate) {
        if (!candidate || typeof candidate !== 'string') {
            return { directUrl: '', contentKey: '' };
        }

        const trimmed = candidate.trim();
        if (!trimmed) {
            return { directUrl: '', contentKey: '' };
        }

        const isAbsoluteUrl = /^(https?:)?\/\//i.test(trimmed);
        const isDataUrl = /^data:/i.test(trimmed);
        const isRootRelative = trimmed.startsWith('/');

        if (isAbsoluteUrl || isDataUrl || isRootRelative) {
            return { directUrl: trimmed, contentKey: '' };
        }

        // Any non-URL value from ContentReference is treated as a CMS key/id.
        return { directUrl: '', contentKey: trimmed };
    }

    extractCmsImageUrl(deliveryDocument) {
        if (!deliveryDocument || typeof deliveryDocument !== 'object') {
            return '';
        }

        const domain = deliveryDocument?.unauthenticatedUrl || deliveryDocument?.domainUrl || '';
        const body =
            deliveryDocument?.contentBody?.url ||
            deliveryDocument?.contentBody?.source?.url ||
            '';

        if (domain && body) {
            try {
                return new URL(body, domain).toString();
            } catch (error) {
                return `${domain}${body}`;
            }
        }

        if (body || domain) {
            return body || domain;
        }

        const firstNode = Object.values(deliveryDocument?.contentNodes || {})[0];
        const nodeUrl =
            firstNode?.url ||
            firstNode?.unauthenticatedUrl ||
            firstNode?.contentBody?.url ||
            firstNode?.source?.url ||
            '';
        if (nodeUrl) {
            return nodeUrl;
        }

        return '';
    }

    buildFallbackMediaUrls(contentKey) {
        if (!contentKey) {
            return [];
        }

        const normalizedBasePath =
            basePath && basePath !== '/' ? basePath.replace(/\/$/, '') : '';
        const encodedKey = encodeURIComponent(contentKey);

        return [
            `${normalizedBasePath}/cms/delivery/media/${encodedKey}`,
            `${normalizedBasePath}/sfsites/c/cms/delivery/media/${encodedKey}`,
            `/cms/delivery/media/${encodedKey}`,
            `/sfsites/c/cms/delivery/media/${encodedKey}`
        ];
    }

    handleImageError() {
        if (this.currentImageAttemptIndex < this.currentImageCandidates.length - 1) {
            this.currentImageAttemptIndex += 1;
        }
    }

    handleCtaClick() {
        const url = this.currentSlide?.ctaUrl;
        if (!url) {
            return;
        }

        window.location.assign(url);
    }

    get debugInfo() {
        const resolved = this.resolveCmsReference(this.currentSlide?.image);
        return `raw=${String(this.currentSlide?.image || '')} | key=${resolved.contentKey || '-'} | attempt=${this.currentImageAttemptIndex + 1}/${this.currentImageCandidates.length || 0} | url=${this.currentImageUrl || '-'} | wireError=${this.lastWireError || '-'}`;
    }
}
