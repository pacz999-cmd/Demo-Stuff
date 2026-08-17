import { LightningElement, track, api } from 'lwc';

export default class DeliveryDatePicker extends LightningElement {
    @api allowSunday = false;
    @api allowMonday = false;
    @api allowTuesday = false;
    @api allowWednesday = false;
    @api allowThursday = false;
    @api allowFriday = false;
    @api allowSaturday = false;

    @track currentViewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    @track selectedDate;

    today = new Date();
    
    daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    get currentMonthName() {
        return this.months[this.currentViewDate.getMonth()];
    }

    get currentYear() {
        return this.currentViewDate.getFullYear();
    }

    get formattedSelectedDate() {
        if (!this.selectedDate) return '';
        return this.selectedDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }

    get calendarDays() {
        const year = this.currentViewDate.getFullYear();
        const month = this.currentViewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        const todayReset = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());

        // Empty slots for previous month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({ id: `empty-${i}`, date: null, containerClass: 'slds-col slds-size_1-of-7 calendar-day empty' });
        }

        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const isoString = date.toISOString();
            const isToday = date.toDateString() === this.today.toDateString();
            const isSelected = this.selectedDate && date.toDateString() === this.selectedDate.toDateString();
            
            const dayOfWeek = date.getDay();
            let isDayEnabled = false;
            switch(dayOfWeek) {
                case 0: isDayEnabled = this.allowSunday; break;
                case 1: isDayEnabled = this.allowMonday; break;
                case 2: isDayEnabled = this.allowTuesday; break;
                case 3: isDayEnabled = this.allowWednesday; break;
                case 4: isDayEnabled = this.allowThursday; break;
                case 5: isDayEnabled = this.allowFriday; break;
                case 6: isDayEnabled = this.allowSaturday; break;
            }

            const disabled = date < todayReset || !isDayEnabled;

            let buttonClass = 'slds-button calendar-day-btn ';
            if (isSelected) {
                buttonClass += 'slds-button_brand selected ';
            } else if (disabled) {
                buttonClass += 'disabled ';
            } else {
                buttonClass += 'slds-button_neutral ';
            }

            if (isToday && !isSelected) {
                buttonClass += 'today ';
            }

            days.push({
                id: isoString,
                date: date,
                dayNumber: i,
                isoString: isoString,
                disabled: disabled,
                containerClass: 'slds-col slds-size_1-of-7 calendar-day',
                buttonClass: buttonClass
            });
        }

        return days;
    }

    handlePrevMonth() {
        this.currentViewDate = new Date(this.currentViewDate.getFullYear(), this.currentViewDate.getMonth() - 1, 1);
    }

    handleNextMonth() {
        this.currentViewDate = new Date(this.currentViewDate.getFullYear(), this.currentViewDate.getMonth() + 1, 1);
    }

    handleDateSelect(event) {
        const dateStr = event.target.dataset.date;
        this.selectedDate = new Date(dateStr);
    }
}